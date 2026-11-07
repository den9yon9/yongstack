import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

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
    return <div className="py-20 text-center text-slate-400">加载中…</div>
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">运行时设置</h2>
            <p className="mt-1 text-sm text-slate-500">
              配置写入数据库，修改后立即生效；未写入的配置使用代码默认值。
            </p>
          </div>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
        {message ? (
          <p
            className={`mt-4 text-sm ${message === '保存成功' ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {message}
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        {items.map((item) => (
          <SettingField
            key={item.key}
            item={item}
            value={values[item.key]}
            onChange={(value) => setValue(item.key, value)}
          />
        ))}
      </section>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-mono text-sm font-semibold text-slate-900">{item.key}</h3>
          <p className="mt-1 text-sm text-slate-500">{item.description}</p>
        </div>
        <span className="text-xs text-slate-400">v{item.version}</span>
      </div>
      <div className="mt-4">
        {item.key === 'app.name' ? (
          <input
            value={asString(value)}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
          />
        ) : item.key === 'auth.requireEmailVerification' || item.key.startsWith('feature.') ? (
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={asBoolean(value)}
              onChange={(event) => onChange(event.target.checked)}
              className="h-4 w-4"
            />
            启用
          </label>
        ) : item.key === 'upload.maxBytes' ? (
          <input
            type="number"
            min={1}
            value={asNumber(value)}
            onChange={(event) => onChange(Number(event.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
          />
        ) : item.key === 'upload.allowedTypes' ? (
          <input
            value={asStringArray(value).join(', ')}
            onChange={(event) =>
              onChange(
                event.target.value
                  .split(',')
                  .map((entry) => entry.trim())
                  .filter((entry) => entry.length > 0),
              )
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none"
          />
        ) : (
          <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
            {JSON.stringify(value, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}
