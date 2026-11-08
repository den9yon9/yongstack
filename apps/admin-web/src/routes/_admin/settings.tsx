import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Alert, AlertDescription } from '@yongstack/ui/components/alert'
import { Badge } from '@yongstack/ui/components/badge'
import { Button } from '@yongstack/ui/components/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@yongstack/ui/components/card'
import { Field, FieldGroup, FieldLabel } from '@yongstack/ui/components/field'
import { Input } from '@yongstack/ui/components/input'
import { Spinner } from '@yongstack/ui/components/spinner'
import { Switch } from '@yongstack/ui/components/switch'

import { api } from '../../libs/api/client'
import type { SettingItem } from '../../libs/api/types'

export const Route = createFileRoute('/_admin/settings')({
  component: SettingsPage,
})

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asBoolean(value: unknown): boolean {
  return value === true
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function valuesFromItems(items: SettingItem[]): Record<string, unknown> {
  return Object.fromEntries(items.map((item) => [item.key, item.value]))
}

function SettingsPage() {
  const [items, setItems] = useState<SettingItem[]>([])
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.admin.settings
      .get()
      .then((res) => {
        if (cancelled) return
        if (res.error !== null) {
          setMessage(res.error.value.message ?? '加载失败')
          return
        }
        setItems(res.data.items)
        setValues(valuesFromItems(res.data.items))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function setValue(key: string, value: unknown) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    const res = await api.admin.settings.put({ values })
    setSaving(false)
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '保存失败')
      return
    }
    setItems(res.data.items)
    setValues(valuesFromItems(res.data.items))
    setMessage('保存成功')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Spinner />
        加载中…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold">运行时设置</h2>
          </CardTitle>
          <CardDescription>
            配置写入数据库，修改后立即生效；未写入的配置使用代码默认值。
          </CardDescription>
          <CardAction>
            <Button onClick={() => void save()} disabled={saving} size="sm">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? '保存中…' : '保存'}
            </Button>
          </CardAction>
        </CardHeader>
        {message ? (
          <CardContent>
            <Alert variant={message === '保存成功' ? 'default' : 'destructive'}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          </CardContent>
        ) : null}
      </Card>

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <SettingField
            key={item.key}
            item={item}
            value={values[item.key]}
            onChange={(value) => setValue(item.key, value)}
          />
        ))}
      </div>
    </div>
  )
}

function SettingField({
  item,
  value,
  onChange,
}: {
  item: SettingItem
  value: unknown
  onChange: (value: unknown) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3 className="font-mono text-sm font-semibold">{item.key}</h3>
        </CardTitle>
        <CardDescription>{item.description}</CardDescription>
        <CardAction>
          <Badge variant="outline">v{item.version}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {item.key === 'app.name' ? (
          <FieldGroup>
            <Field>
              <Input
                id={item.key}
                aria-label={item.key}
                value={asString(value)}
                onChange={(event) => onChange(event.target.value)}
              />
            </Field>
          </FieldGroup>
        ) : item.key === 'auth.requireEmailVerification' || item.key.startsWith('feature.') ? (
          <Field orientation="horizontal">
            <Switch
              id={item.key}
              checked={asBoolean(value)}
              onCheckedChange={(checked) => onChange(checked)}
            />
            <FieldLabel htmlFor={item.key}>启用</FieldLabel>
          </Field>
        ) : item.key === 'upload.maxBytes' ? (
          <FieldGroup>
            <Field>
              <Input
                id={item.key}
                aria-label={item.key}
                type="number"
                min={1}
                value={asNumber(value)}
                onChange={(event) => onChange(Number(event.target.value))}
              />
            </Field>
          </FieldGroup>
        ) : item.key === 'upload.allowedTypes' ? (
          <FieldGroup>
            <Field>
              <Input
                id={item.key}
                aria-label={item.key}
                value={asStringArray(value).join(', ')}
                onChange={(event) =>
                  onChange(
                    event.target.value
                      .split(',')
                      .map((entry) => entry.trim())
                      .filter((entry) => entry.length > 0),
                  )
                }
              />
            </Field>
          </FieldGroup>
        ) : (
          <pre className="overflow-auto rounded-lg bg-muted/60 p-3 text-xs">
            {JSON.stringify(value, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}
