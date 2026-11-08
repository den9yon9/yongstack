import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { api } from '../libs/api/client'
import {
  bindPhone,
  logout,
  refreshSession,
  requestPhoneBindCode,
  unbindPhone,
  useSession,
} from '../libs/api/session'
import type { AuthUser, SessionItem } from '../libs/api/types'

export const Route = createFileRoute('/me')({
  beforeLoad: async () => {
    const user = await refreshSession()
    if (!user) throw redirect({ to: '/login' })
  },
  component: MePage,
})

function MePage() {
  const navigate = useNavigate()
  const session = useSession()
  const [editing, setEditing] = useState(false)

  if (session === undefined || session === null) {
    return <div className="py-20 text-center text-slate-400">加载中…</div>
  }

  const user = session

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
          {(user.name ?? user.email ?? user.phone ?? 'U').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{user.name ?? '未设置昵称'}</p>
          <p className="truncate text-sm text-slate-500">{user.email ?? '未绑定邮箱'}</p>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            编辑资料
          </button>
        ) : null}
      </section>

      {editing ? (
        <ProfileForm user={user} onDone={() => setEditing(false)} />
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex justify-between py-1 text-sm">
            <span className="text-slate-500">手机号</span>
            <span className="text-slate-900">
              {user.phone
                ? `${user.phone}${user.phoneVerifiedAt ? '（已验证）' : '（未验证）'}`
                : '未设置'}
            </span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-slate-500">角色</span>
            <span className="text-slate-900">
              {user.roles.includes('admin') ? '管理员' : '成员'}
            </span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-slate-500">注册时间</span>
            <span className="text-slate-900">{new Date(user.createdAt).toLocaleDateString()}</span>
          </div>
        </section>
      )}

      <PhoneSection user={user} />
      <SessionsSection />
      <ChangePasswordSection />

      <button
        onClick={() => void logout().then(() => navigate({ to: '/', replace: true }))}
        className="rounded-2xl border border-slate-200 bg-white py-3 text-sm text-red-600 shadow-sm hover:bg-red-50"
      >
        退出登录
      </button>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none'

function ProfileForm({ user, onDone }: { user: AuthUser; onDone: () => void }) {
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
    await refreshSession()
    onDone()
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">昵称</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">头像地址</span>
        <input
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          placeholder="可选，填写图片 URL"
          className={inputCls}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-brand-600 py-2.5 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? '保存中…' : '保存'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-slate-600 hover:bg-slate-50"
        >
          取消
        </button>
      </div>
    </form>
  )
}

function PhoneSection({ user }: { user: AuthUser }) {
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
    const result = await requestPhoneBindCode(phone)
    setSending(false)
    if (result.error !== null) {
      setError(result.error)
      return
    }
    setCountdown(60)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setSubmitting(true)
    const result = await bindPhone(phone, code)
    setSubmitting(false)
    if (result.error !== null) {
      setError(result.error)
      return
    }
    setCode('')
    setMessage('手机号已绑定')
  }

  async function unbind() {
    setError(null)
    setMessage(null)
    const result = await unbindPhone()
    if (result.error !== null) {
      setError(result.error)
      return
    }
    setPhone('')
    setMessage('手机号已解绑')
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">手机号登录</h2>
          <p className="mt-1 text-sm text-slate-500">
            绑定后可使用手机号验证码登录。手机号需为 E.164 格式（如 +8613800000000）。
          </p>
        </div>
        {user.phone ? (
          <button
            onClick={() => void unbind()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            解绑
          </button>
        ) : null}
      </div>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">手机号</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+8613800000000"
            required
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">验证码</span>
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              required
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={sending || countdown > 0 || phone.length === 0}
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {countdown > 0 ? `${countdown}s` : sending ? '发送中…' : '获取验证码'}
            </button>
          </div>
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 py-2.5 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? '绑定中…' : '绑定手机号'}
        </button>
      </form>
    </section>
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">活跃会话</h2>
          <p className="mt-1 text-sm text-slate-500">查看并撤销其他设备上的登录状态。</p>
        </div>
        <button
          onClick={() => void revokeOthers()}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          退出其他设备
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-4 divide-y divide-slate-100">
        {sessions === null ? (
          <p className="py-3 text-sm text-slate-400">加载中…</p>
        ) : sessions.length === 0 ? (
          <p className="py-3 text-sm text-slate-400">暂无会话</p>
        ) : (
          sessions.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0 text-sm">
                <p className="truncate text-slate-900">
                  {item.userAgent ?? '未知设备'}
                  {item.current ? (
                    <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                      当前
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-400">
                  {item.ip ?? '未知 IP'} · 最近活跃 {new Date(item.lastSeenAt).toLocaleString()}
                </p>
              </div>
              {!item.current ? (
                <button
                  onClick={() => void revoke(item.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  撤销
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">修改密码</h2>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">当前密码</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">新密码（至少 8 位）</span>
          <input
            type="password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className={inputCls}
          />
        </label>
        {message ? (
          <p
            className={`text-sm ${message.startsWith('密码已更新') ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 py-2.5 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? '更新中…' : '更新密码'}
        </button>
      </form>
    </section>
  )
}
