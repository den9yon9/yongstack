import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { api } from '../libs/api/client'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const res = await api.auth.login.post({ email, password })
    setSubmitting(false)
    if (res.error !== null) {
      setError(res.error.value.message ?? '登录失败')
      return
    }
    navigate({ to: '/', replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-6 text-xl font-bold text-slate-900">Nestup 管理后台</h1>
        <label className="mb-1 block text-sm text-slate-600">
          邮箱
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="mb-4 mt-4 block text-sm text-slate-600">
          密码
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
          />
        </label>
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  )
}
