import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { login } from '../libs/api/session'

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
    const result = await login(email, password)
    setSubmitting(false)
    if (!result.user) {
      setError(result.error ?? '登录失败')
      return
    }
    navigate({ to: '/', replace: true })
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-sm flex-col gap-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">登录 Yongstack</h1>
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
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">密码</span>
        <input
          type="password"
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
        {submitting ? '登录中…' : '登录'}
      </button>
      <p className="text-right text-sm">
        <Link to="/forgot-password" className="text-brand-600 hover:underline">
          忘记密码？
        </Link>
      </p>
      <p className="text-center text-sm text-slate-500">
        还没有账号？
        <Link to="/register" className="ml-1 text-brand-600 hover:underline">
          去注册
        </Link>
      </p>
    </form>
  )
}
