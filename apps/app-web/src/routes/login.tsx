import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { login, loginWithPhone, requestPhoneCode } from '../libs/api/session'

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
    const result = await login(email, password)
    setSubmitting(false)
    if (!result.user) {
      setError(result.error ?? '登录失败')
      return
    }
    navigate({ to: '/', replace: true })
  }

  async function sendCode() {
    setError(null)
    setSending(true)
    const result = await requestPhoneCode(phone)
    setSending(false)
    if (result.error !== null) {
      setError(result.error)
      return
    }
    setCountdown(60)
  }

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await loginWithPhone(phone, code)
    setSubmitting(false)
    if (!result.user) {
      setError(result.error ?? '登录失败')
      return
    }
    navigate({ to: '/', replace: true })
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 py-6">
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-sm">
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
        <form onSubmit={submitEmail} className="flex flex-col gap-4">
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
        </form>
      ) : (
        <form onSubmit={submitPhone} className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">手机号登录</h1>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">手机号</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+8613800000000"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
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
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 py-2.5 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? '登录中…' : '登录'}
          </button>
          <p className="text-center text-xs text-slate-400">
            未注册的手机号验证成功后将自动创建账号
          </p>
        </form>
      )}

      <p className="text-center text-sm text-slate-500">
        还没有账号？
        <Link to="/register" className="ml-1 text-brand-600 hover:underline">
          去注册
        </Link>
      </p>
    </div>
  )
}
