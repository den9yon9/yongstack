import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'

import { Alert, AlertDescription } from '@yongstack/ui/components/alert'
import { Button } from '@yongstack/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@yongstack/ui/components/card'
import { Field, FieldGroup, FieldLabel } from '@yongstack/ui/components/field'
import { Input } from '@yongstack/ui/components/input'
import { Spinner } from '@yongstack/ui/components/spinner'

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
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold tracking-tight">忘记密码</h1>
        </CardTitle>
        <CardDescription>输入注册邮箱，我们会发送重置链接。</CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="flex flex-col gap-4">
            <Alert>
              <AlertDescription>
                重置邮件已发送。请检查邮箱（邮箱不存在时也会返回相同提示）。
              </AlertDescription>
            </Alert>
            <Link to="/login" className="text-sm text-primary hover:underline">
              返回登录
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="forgot-email">邮箱</FieldLabel>
                <Input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
              {submitting ? '发送中…' : '发送重置邮件'}
            </Button>
            <Link to="/login" className="text-center text-sm text-primary hover:underline">
              返回登录
            </Link>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center text-xs text-muted-foreground">
        出于安全考虑，我们不会透露邮箱是否已注册。
      </CardFooter>
    </Card>
  )
}
