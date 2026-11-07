import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'

import { api } from '../libs/api/client'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const res = await api.auth['forgot-password'].post({ email })
    setSubmitting(false)
    if (res.error !== null) {
      setError(res.error.value.message ?? '发送失败')
      return
    }
    setSent(true)
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">忘记密码</h1>
      {sent ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            重置邮件已发送。请检查邮箱（邮箱不存在时也会返回相同提示）。
          </p>
          <Link to="/login" className="text-sm text-brand-600 hover:underline">
            返回登录
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {submitting ? '发送中…' : '发送重置邮件'}
          </button>
          <Link to="/login" className="text-center text-sm text-brand-600 hover:underline">
            返回登录
          </Link>
        </form>
      )}
    </div>
  )
}
