import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@yongstack/ui/components/input-group'
import { Spinner } from '@yongstack/ui/components/spinner'
import { ToggleGroup, ToggleGroupItem } from '@yongstack/ui/components/toggle-group'

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
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold tracking-tight">登录 Yongstack</h1>
        </CardTitle>
        <CardDescription>使用邮箱或手机号登录你的账号。</CardDescription>
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
                  <FieldLabel htmlFor="login-email">邮箱</FieldLabel>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="login-password">密码</FieldLabel>
                  <Input
                    id="login-password"
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
              <p className="text-right text-sm">
                <Link to="/forgot-password" className="text-primary hover:underline">
                  忘记密码？
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={submitPhone} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="login-phone">手机号</FieldLabel>
                  <Input
                    id="login-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+8613800000000"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="login-code">验证码</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="login-code"
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
              <p className="text-center text-xs text-muted-foreground">
                未注册的手机号验证成功后将自动创建账号
              </p>
            </form>
          )}
        </div>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        还没有账号？
        <Link to="/register" className="ml-1 text-primary hover:underline">
          去注册
        </Link>
      </CardFooter>
    </Card>
  )
}
