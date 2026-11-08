import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { LogOutIcon, PencilIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Alert, AlertDescription } from '@yongstack/ui/components/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@yongstack/ui/components/avatar'
import { Badge } from '@yongstack/ui/components/badge'
import { Button } from '@yongstack/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@yongstack/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@yongstack/ui/components/dialog'
import { EmptyState } from '@yongstack/ui'
import { Field, FieldGroup, FieldLabel } from '@yongstack/ui/components/field'
import { Input } from '@yongstack/ui/components/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@yongstack/ui/components/input-group'
import { Separator } from '@yongstack/ui/components/separator'
import { Spinner } from '@yongstack/ui/components/spinner'

import { api } from '../libs/api/client'
import type { AuthUser, SessionItem } from '../libs/api/types'

export const Route = createFileRoute('/me')({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: '/login' })
  },
  component: MePage,
})

function MePage() {
  const navigate = useNavigate()
  const router = useRouter()
  const session = Route.useRouteContext().user
  const [editing, setEditing] = useState(false)

  if (session === undefined || session === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Spinner />
        加载中…
      </div>
    )
  }

  const user = session
  const displayName = user.name ?? user.email ?? user.phone ?? 'U'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar size="lg">
            {user.avatar ? <AvatarImage src={user.avatar} alt={displayName} /> : null}
            <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
              {displayName.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{user.name ?? '未设置昵称'}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email ?? '未绑定邮箱'}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <PencilIcon data-icon="inline-start" />
            编辑资料
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">账号信息</h2>
          </CardTitle>
          <CardDescription>账号的基础信息与注册状态。</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col">
            <div className="flex items-center justify-between gap-4 py-2 text-sm">
              <dt className="text-muted-foreground">手机号</dt>
              <dd>
                {user.phone
                  ? `${user.phone}${user.phoneVerifiedAt ? '（已验证）' : '（未验证）'}`
                  : '未设置'}
              </dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4 py-2 text-sm">
              <dt className="text-muted-foreground">角色</dt>
              <dd>
                <Badge variant={user.roles.includes('admin') ? 'default' : 'secondary'}>
                  {user.roles.includes('admin') ? '管理员' : '成员'}
                </Badge>
              </dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4 py-2 text-sm">
              <dt className="text-muted-foreground">注册时间</dt>
              <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <PhoneSection user={user} />
      <SessionsSection />
      <ChangePasswordSection />

      <Button
        variant="destructive"
        className="w-full"
        onClick={() =>
          void api.auth.logout
            .post({} as never)
            .then(() => router.invalidate())
            .then(() => navigate({ to: '/', replace: true }))
        }
      >
        <LogOutIcon data-icon="inline-start" />
        退出登录
      </Button>

      <ProfileDialog user={user} open={editing} onOpenChange={setEditing} />
    </div>
  )
}

function ProfileDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AuthUser
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState(user.name ?? '')
  const [avatar, setAvatar] = useState(user.avatar ?? '')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const res = await api.auth.me.patch({
      ...(name ? { name } : {}),
      ...(avatar ? { avatar } : {}),
    })
    setSubmitting(false)
    if (res.error !== null) {
      setError(res.error.value.message ?? '保存失败')
      return
    }
    await router.invalidate()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑资料</DialogTitle>
          <DialogDescription>更新昵称和头像地址。</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="profile-name">昵称</FieldLabel>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-avatar">头像地址</FieldLabel>
              <Input
                id="profile-avatar"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="可选，填写图片 URL"
              />
            </Field>
          </FieldGroup>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner data-icon="inline-start" /> : null}
              {submitting ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PhoneSection({ user }: { user: AuthUser }) {
  const router = useRouter()
  const [phone, setPhone] = useState(user.phone ?? '')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  async function sendCode() {
    setError(null)
    setMessage(null)
    setSending(true)
    const res = await api.auth.phone.bind['request-code'].post({ phone })
    setSending(false)
    if (res.error !== null) {
      setError(res.error.value.message ?? '发送验证码失败')
      return
    }
    setCountdown(60)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setSubmitting(true)
    const res = await api.auth.phone.bind.post({ phone, code })
    setSubmitting(false)
    if (res.error !== null) {
      setError(res.error.value.message ?? '绑定失败')
      return
    }
    await router.invalidate()
    setCode('')
    setMessage('手机号已绑定')
  }

  async function unbind() {
    setError(null)
    setMessage(null)
    const res = await api.auth.phone.delete(undefined)
    if (res.error !== null) {
      setError(res.error.value.message ?? '解绑失败')
      return
    }
    await router.invalidate()
    setPhone('')
    setMessage('手机号已解绑')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">手机号登录</h2>
        </CardTitle>
        <CardDescription>
          绑定后可使用手机号验证码登录。手机号需为 E.164 格式（如 +8613800000000）。
        </CardDescription>
        {user.phone ? (
          <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
            <Button variant="outline" size="sm" onClick={() => void unbind()}>
              解绑
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="phone-number">手机号</FieldLabel>
              <Input
                id="phone-number"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+8613800000000"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone-code">验证码</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="phone-code"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  required
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    onClick={() => void sendCode()}
                    disabled={sending || countdown > 0 || phone.length === 0}
                  >
                    {countdown > 0 ? `${countdown}s` : sending ? '发送中…' : '获取验证码'}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </FieldGroup>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {message ? (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? <Spinner data-icon="inline-start" /> : null}
            {submitting ? '绑定中…' : '绑定手机号'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function SessionsSection() {
  const [sessions, setSessions] = useState<SessionItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const res = await api.auth.sessions.get()
    if (res.error !== null) {
      setError(res.error.value.message ?? '加载会话失败')
      return
    }
    setError(null)
    setSessions(res.data.items)
  }

  useEffect(() => {
    void load()
  }, [])

  async function revoke(id: string) {
    await api.auth.sessions({ id }).delete(undefined)
    await load()
  }

  async function revokeOthers() {
    await api.auth.sessions.delete(undefined)
    await load()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">活跃会话</h2>
        </CardTitle>
        <CardDescription>查看并撤销其他设备上的登录状态。</CardDescription>
        <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
          <Button variant="outline" size="sm" onClick={() => void revokeOthers()}>
            退出其他设备
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {sessions === null ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Spinner />
            加载中…
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState title="暂无会话" description="登录后这里会显示活跃设备。" />
        ) : (
          <div className="flex flex-col">
            {sessions.map((item, index) => (
              <div key={item.id} className="flex flex-col">
                {index > 0 ? <Separator /> : null}
                <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0 text-sm">
                    <p className="flex items-center gap-2 truncate">
                      {item.userAgent ?? '未知设备'}
                      {item.current ? <Badge variant="secondary">当前</Badge> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.ip ?? '未知 IP'} · 最近活跃 {new Date(item.lastSeenAt).toLocaleString()}
                    </p>
                  </div>
                  {!item.current ? (
                    <Button variant="link" size="sm" onClick={() => void revoke(item.id)}>
                      撤销
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setSubmitting(true)
    const res = await api.auth['change-password'].post({ currentPassword, newPassword })
    setSubmitting(false)
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '修改失败')
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setMessage('密码已更新，其他设备已退出。')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">修改密码</h2>
        </CardTitle>
        <CardDescription>更新密码后，其他设备会自动退出登录。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="current-password">当前密码</FieldLabel>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">新密码（至少 8 位）</FieldLabel>
              <Input
                id="new-password"
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </Field>
          </FieldGroup>
          {message ? (
            <Alert variant={message.startsWith('密码已更新') ? 'default' : 'destructive'}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? <Spinner data-icon="inline-start" /> : null}
            {submitting ? '更新中…' : '更新密码'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
