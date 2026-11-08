import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { Alert, AlertDescription } from '@yongstack/ui/components/alert'
import { buttonVariants } from '@yongstack/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@yongstack/ui/components/card'
import { Spinner } from '@yongstack/ui/components/spinner'

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
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold tracking-tight">验证邮箱</h1>
        </CardTitle>
        <CardDescription>正在确认你的邮箱地址。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status === 'loading' ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            验证中…
          </div>
        ) : null}
        {status === 'ok' ? (
          <Alert>
            <AlertDescription>邮箱验证成功。</AlertDescription>
          </Alert>
        ) : null}
        {status === 'error' ? (
          <Alert variant="destructive">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        <Link to="/" className={buttonVariants({ variant: 'link', className: 'w-fit px-0' })}>
          返回首页
        </Link>
      </CardContent>
    </Card>
  )
}
