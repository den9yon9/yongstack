import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'

import { api } from '../libs/api/client'

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const res = await api.auth['reset-password'].post({ token, password })
    setSubmitting(false)
    if (res.error !== null) {
      setError(res.error.value.message ?? '重置失败')
      return
    }
    setDone(true)
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-sm space-y-4 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">重置密码</h1>
        <p className="text-sm text-red-600">无效的重置链接。</p>
        <Link to="/forgot-password" className="text-sm text-brand-600 hover:underline">
          重新发送重置邮件
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">重置密码</h1>
      {done ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            密码已重置，其他设备会话已失效。
          </p>
          <Link to="/login" className="text-sm text-brand-600 hover:underline">
            去登录
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">新密码（至少 8 位）</span>
            <input
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 py-2.5 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? '提交中…' : '重置密码'}
          </button>
        </form>
      )}
    </div>
  )
}
