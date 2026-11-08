import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
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

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const res = await api.auth.register.post({ name, email, password })
    setSubmitting(false)
    if (res.error !== null) {
      setError(res.error.value.message ?? '注册失败')
      return
    }
    await router.invalidate()
    navigate({ to: '/', replace: true })
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold tracking-tight">注册 Yongstack</h1>
        </CardTitle>
        <CardDescription>创建账号，开始使用完整模板能力。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="register-name">昵称</FieldLabel>
              <Input
                id="register-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="register-email">邮箱</FieldLabel>
              <Input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="register-password">密码（至少 8 位）</FieldLabel>
              <Input
                id="register-password"
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
            {submitting ? '注册中…' : '注册'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        已有账号？
        <Link to="/login" className="ml-1 text-primary hover:underline">
          去登录
        </Link>
      </CardFooter>
    </Card>
  )
}
