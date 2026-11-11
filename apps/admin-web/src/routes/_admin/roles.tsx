import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

import { EmptyState } from '@yongstack/ui'
import { Alert, AlertDescription } from '@yongstack/ui/components/alert'
import { Badge } from '@yongstack/ui/components/badge'
import { Button } from '@yongstack/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@yongstack/ui/components/card'
import { Checkbox } from '@yongstack/ui/components/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@yongstack/ui/components/dialog'
import { Field, FieldGroup, FieldLabel } from '@yongstack/ui/components/field'
import { Input } from '@yongstack/ui/components/input'
import { Spinner } from '@yongstack/ui/components/spinner'
import { Textarea } from '@yongstack/ui/components/textarea'

import { api } from '../../libs/api/client'
import type { AdminRole } from '../../libs/api/types'

export const Route = createFileRoute('/_admin/roles')({
  component: RolesPage,
})

interface PermissionItem {
  code: string
  description: string | null
}

type RoleFormTarget =
  { mode: 'create' } | { mode: 'edit'; role: AdminRole } | { mode: 'copy'; role: AdminRole }

function RolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [formTarget, setFormTarget] = useState<RoleFormTarget | null>(null)
  const [permTarget, setPermTarget] = useState<AdminRole | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminRole | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [rolesRes, permissionsRes] = await Promise.all([
      api.admin.roles.get(),
      api.admin.permissions.get(),
    ])
    setLoading(false)
    if (rolesRes.error !== null) {
      setError(rolesRes.error.value.message ?? '加载角色失败')
      return
    }
    if (permissionsRes.error !== null) {
      setError(permissionsRes.error.value.message ?? '加载权限失败')
      return
    }
    setRoles(rolesRes.data.items)
    setPermissions(permissionsRes.data.items)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function removeRole(role: AdminRole) {
    setError(null)
    setMessage(null)
    const res = await api.admin.roles({ code: role.code }).delete(undefined)
    if (res.error !== null) {
      setError(res.error.value.message ?? '删除失败')
      return
    }
    setDeleteTarget(null)
    setMessage(`角色 ${role.name} 已删除`)
    await load()
  }

  return (
    <div className="flex flex-col gap-6">
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

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold">角色权限</h2>
          </CardTitle>
          <CardDescription>
            内置角色只读；可创建或复制自定义角色并分配权限。自定义角色需勾选 admin:access
            才能进入管理后台。
          </CardDescription>
          <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
            <Button size="sm" onClick={() => setFormTarget({ mode: 'create' })}>
              新建角色
            </Button>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <Card>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              加载中…
            </CardContent>
          </Card>
        ) : roles.length === 0 ? (
          <EmptyState title="暂无角色" description="创建第一个自定义角色。" />
        ) : (
          roles.map((role) => (
            <Card key={role.code}>
              <CardHeader>
                <CardTitle>
                  <h3 className="text-base font-semibold">{role.name}</h3>
                </CardTitle>
                <CardDescription className="font-mono text-xs">{role.code}</CardDescription>
                {role.isSystem ? (
                  <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
                    <Badge variant="secondary">系统</Badge>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{role.description ?? '—'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.map((permission) => (
                    <Badge key={permission} variant="secondary" className="font-mono">
                      {permission}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {role.isSystem ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFormTarget({ mode: 'copy', role })}
                    >
                      复制为自定义角色
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPermTarget(role)}
                    disabled={role.isSystem}
                    title={role.isSystem ? '系统角色只读，请复制为自定义角色后修改' : undefined}
                  >
                    编辑权限
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFormTarget({ mode: 'edit', role })}
                    disabled={role.isSystem}
                    title={role.isSystem ? '系统角色只读，请复制为自定义角色后修改' : undefined}
                  >
                    编辑信息
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteTarget(role)}
                    disabled={role.isSystem}
                    title={role.isSystem ? '系统角色不可删除' : undefined}
                  >
                    删除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            <h3 className="text-base font-semibold">全部权限</h3>
          </CardTitle>
          <CardDescription>系统当前注册的所有权限码。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {permissions.map((permission) => (
              <div key={permission.code} className="rounded-lg bg-muted/60 px-3 py-2">
                <p className="font-mono text-sm">{permission.code}</p>
                <p className="text-xs text-muted-foreground">{permission.description ?? '—'}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <RoleFormDialog
        target={formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={async (text) => {
          setFormTarget(null)
          setMessage(text)
          await load()
        }}
      />

      <PermissionsDialog
        role={permTarget}
        permissions={permissions}
        onClose={() => setPermTarget(null)}
        onSaved={async (role) => {
          setPermTarget(null)
          setMessage(`角色 ${role.name} 的权限已更新，相关用户会话已失效`)
          await load()
        }}
      />

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除角色</DialogTitle>
            <DialogDescription>
              确定删除角色 {deleteTarget?.name}？仅当没有用户使用该角色时允许删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && void removeRole(deleteTarget)}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RoleFormDialog({
  target,
  onClose,
  onSaved,
}: {
  target: RoleFormTarget | null
  onClose: () => void
  onSaved: (message: string) => Promise<void>
}) {
  const mode = target?.mode
  const role = target !== null && target.mode !== 'create' ? target.role : null
  const isNew = mode === 'create' || mode === 'copy'
  const isCopy = mode === 'copy'
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (target === null) {
      return
    }
    if (target.mode === 'create') {
      setCode('')
      setName('')
      setDescription('')
      setSelectedPermissions([])
    } else {
      setCode(target.mode === 'copy' ? `${target.role.code}-copy` : target.role.code)
      setName(target.mode === 'copy' ? `${target.role.name} Copy` : target.role.name)
      setDescription(target.role.description ?? '')
      setSelectedPermissions(target.role.permissions)
    }
    setError(null)
  }, [target])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    if (isNew) {
      const res = await api.admin.roles.post({
        code,
        name,
        permissions: selectedPermissions,
        ...(description ? { description } : {}),
      })
      setSubmitting(false)
      if (res.error !== null) {
        setError(res.error.value.message ?? '创建失败')
        return
      }
      await onSaved(isCopy ? `角色 ${res.data.name} 已复制` : `角色 ${res.data.name} 已创建`)
      return
    }
    if (!role) return
    const res = await api.admin.roles({ code: role.code }).patch({
      name,
      description: description ? description : null,
    })
    setSubmitting(false)
    if (res.error !== null) {
      setError(res.error.value.message ?? '保存失败')
      return
    }
    await onSaved(`角色 ${res.data.name} 已更新`)
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCopy ? '复制角色' : isNew ? '新建角色' : '编辑角色'}</DialogTitle>
          <DialogDescription>
            {isNew ? '角色码创建后不可修改。' : '系统角色只读。'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="role-code">角色码</FieldLabel>
              <Input
                id="role-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="support"
                pattern="^[a-z][a-z0-9_-]{1,63}$"
                disabled={!isNew}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="role-name">名称</FieldLabel>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="role-description">描述</FieldLabel>
              <Textarea
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </Field>
          </FieldGroup>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
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

function PermissionsDialog({
  role,
  permissions,
  onClose,
  onSaved,
}: {
  role: AdminRole | null
  permissions: PermissionItem[]
  onClose: () => void
  onSaved: (role: AdminRole) => Promise<void>
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (role === null) return
    setSelected(role.permissions)
    setError(null)
  }, [role])

  function toggle(code: string) {
    setSelected((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    )
  }

  async function submit() {
    if (!role) return
    setSubmitting(true)
    setError(null)
    const res = await api.admin
      .roles({ code: role.code })
      .permissions.put({ permissions: selected })
    setSubmitting(false)
    if (res.error !== null) {
      setError(res.error.value.message ?? '保存失败')
      return
    }
    await onSaved(res.data)
  }

  return (
    <Dialog open={role !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>编辑权限 · {role?.name}</DialogTitle>
          <DialogDescription>
            保存后该角色下所有用户的会话会被撤销，下次请求使用新权限。
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-80 flex-col gap-2 overflow-auto pr-1">
          {permissions.map((permission) => (
            <label
              key={permission.code}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50"
            >
              <Checkbox
                checked={selected.includes(permission.code)}
                onCheckedChange={() => toggle(permission.code)}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-mono text-xs">{permission.code}</span>
                <span className="text-xs text-muted-foreground">
                  {permission.description ?? '—'}
                </span>
              </span>
            </label>
          ))}
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? <Spinner data-icon="inline-start" /> : null}
            {submitting ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
