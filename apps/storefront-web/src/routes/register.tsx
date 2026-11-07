import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { register } from '../libs/api/session'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await register(name, email, password)
    setSubmitting(false)
    if (!result.user) {
      setError(result.error ?? '注册失败')
      return
    }
    navigate({ to: '/', replace: true })
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-sm flex-col gap-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">注册 Nestup</h1>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">昵称</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
        />
      </label>
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
        <span className="mb-1 block text-sm text-slate-600">密码（至少 8 位）</span>
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
        {submitting ? '注册中…' : '注册'}
      </button>
      <p className="text-center text-sm text-slate-500">
        已有账号？
        <Link to="/login" className="ml-1 text-brand-600 hover:underline">
          去登录
        </Link>
      </p>
    </form>
  )
}
