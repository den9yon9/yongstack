import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'

import { Alert, AlertDescription } from '@yongstack/ui/components/alert'
import { Button } from '@yongstack/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@yongstack/ui/components/card'
import { Field, FieldGroup, FieldLabel } from '@yongstack/ui/components/field'
import { Input } from '@yongstack/ui/components/input'
import { Spinner } from '@yongstack/ui/components/spinner'

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
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-semibold tracking-tight">重置密码</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertDescription>无效的重置链接。</AlertDescription>
          </Alert>
          <Link to="/forgot-password" className="text-sm text-primary hover:underline">
            重新发送重置邮件
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold tracking-tight">重置密码</h1>
        </CardTitle>
        <CardDescription>设置一个新密码，其他设备会话将失效。</CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <div className="flex flex-col gap-4">
            <Alert>
              <AlertDescription>密码已重置，其他设备会话已失效。</AlertDescription>
            </Alert>
            <Link to="/login" className="text-sm text-primary hover:underline">
              去登录
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="reset-password">新密码（至少 8 位）</FieldLabel>
                <Input
                  id="reset-password"
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
            </FieldGroup>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Spinner data-icon="inline-start" /> : null}
              {submitting ? '提交中…' : '重置密码'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
