import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@yongstack/ui/components/input-group'
import { Spinner } from '@yongstack/ui/components/spinner'
import { ToggleGroup, ToggleGroupItem } from '@yongstack/ui/components/toggle-group'

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
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-bold tracking-tight">Yongstack 管理后台</h1>
          </CardTitle>
          <CardDescription>使用管理员账号登录控制台。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <ToggleGroup
              value={[mode]}
              onValueChange={(value) => {
                const next = value[0]
                if (next === 'email' || next === 'phone') {
                  setMode(next)
                  setError(null)
                }
              }}
              className="grid w-full grid-cols-2"
              spacing={0}
              variant="outline"
            >
              <ToggleGroupItem value="email" className="w-full">
                邮箱登录
              </ToggleGroupItem>
              <ToggleGroupItem value="phone" className="w-full">
                手机号登录
              </ToggleGroupItem>
            </ToggleGroup>

            {mode === 'email' ? (
              <form onSubmit={submitEmail} className="flex flex-col gap-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="admin-email">邮箱</FieldLabel>
                    <Input
                      id="admin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="admin-password">密码</FieldLabel>
                    <Input
                      id="admin-password"
                      type="password"
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
                  {submitting ? '登录中…' : '登录'}
                </Button>
              </form>
            ) : (
              <form onSubmit={submitPhone} className="flex flex-col gap-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="admin-phone">手机号</FieldLabel>
                    <Input
                      id="admin-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+8613800000000"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="admin-code">验证码</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="admin-code"
                        inputMode="numeric"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        maxLength={6}
                        required
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          onClick={() => void sendCode()}
                          disabled={sending || countdown > 0 || phone.length === 0}
                        >
                          {countdown > 0 ? `${countdown}s` : sending ? '发送中…' : '获取验证码'}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>
                </FieldGroup>
                {error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Spinner data-icon="inline-start" /> : null}
                  {submitting ? '登录中…' : '登录'}
                </Button>
              </form>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
