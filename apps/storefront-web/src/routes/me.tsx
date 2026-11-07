import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { api } from '../libs/api/client'
import { logout, refreshSession, useSession } from '../libs/api/session'
import type { AuthUser } from '../libs/api/types'

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
          {(user.name ?? user.email).slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{user.name ?? '未设置昵称'}</p>
          <p className="truncate text-sm text-slate-500">{user.email}</p>
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
            <span className="text-slate-900">{user.phone ?? '未设置'}</span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-slate-500">角色</span>
            <span className="text-slate-900">{user.role === 'admin' ? '管理员' : '普通用户'}</span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-slate-500">注册时间</span>
            <span className="text-slate-900">{new Date(user.createdAt).toLocaleDateString()}</span>
          </div>
        </section>
      )}

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
  const [phone, setPhone] = useState(user.phone ?? '')
  const [avatar, setAvatar] = useState(user.avatar ?? '')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const res = await api.auth.me.patch({
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
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
        <span className="mb-1 block text-sm text-slate-600">手机号</span>
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
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
