import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { api } from '../libs/api/client'

export const Route = createFileRoute('/verify-email')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  const { token } = Route.useSearch()
  const started = useRef(false)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!token) {
      setStatus('error')
      setMessage('无效的验证链接。')
      return
    }
    api.auth['verify-email']
      .post({ token })
      .then((res) => {
        if (res.error !== null) {
          setStatus('error')
          setMessage(res.error.value.message ?? '验证失败')
          return
        }
        setStatus('ok')
      })
      .catch(() => {
        setStatus('error')
        setMessage('验证失败')
      })
  }, [token])

  return (
    <div className="mx-auto max-w-sm space-y-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">验证邮箱</h1>
      {status === 'loading' ? <p className="text-sm text-slate-500">验证中…</p> : null}
      {status === 'ok' ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          邮箱验证成功。
        </p>
      ) : null}
      {status === 'error' ? <p className="text-sm text-red-600">{message}</p> : null}
      <Link to="/" className="text-sm text-brand-600 hover:underline">
        返回首页
      </Link>
    </div>
  )
}
