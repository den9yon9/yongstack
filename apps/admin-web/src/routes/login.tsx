import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { api } from '../libs/api/client'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'email' | 'phone'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  async function submitEmail(e: React.FormEvent) {
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

  async function sendCode() {
    setError(null)
    setSending(true)
    const res = await api.auth.phone['request-code'].post({ phone })
    setSending(false)
    if (res.error !== null) {
      setError(res.error.value.message ?? '发送验证码失败')
      return
    }
    setCountdown(60)
  }

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const res = await api.auth.phone.login.post({ phone, code })
    setSubmitting(false)
    if (res.error !== null) {
      setError(res.error.value.message ?? '登录失败')
      return
    }
    navigate({ to: '/', replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-bold text-slate-900">Yongstack 管理后台</h1>
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              setMode('email')
              setError(null)
            }}
            className={`rounded-md py-2 ${mode === 'email' ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`}
          >
            邮箱登录
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('phone')
              setError(null)
            }}
            className={`rounded-md py-2 ${mode === 'phone' ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`}
          >
            手机号登录
          </button>
        </div>

        {mode === 'email' ? (
          <form onSubmit={submitEmail}>
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
        ) : (
          <form onSubmit={submitPhone}>
            <label className="mb-1 block text-sm text-slate-600">
              手机号
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+8613800000000"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="mb-4 mt-4 block text-sm text-slate-600">
              验证码
              <div className="mt-1 flex gap-2">
                <input
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void sendCode()}
                  disabled={sending || countdown > 0 || phone.length === 0}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {countdown > 0 ? `${countdown}s` : sending ? '发送中…' : '获取验证码'}
                </button>
              </div>
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
        )}
      </div>
    </div>
  )
}
