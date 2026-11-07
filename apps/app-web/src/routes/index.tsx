import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { api } from '../libs/api/client'

interface ServiceInfo {
  service: string
  version: string
  runtime: string
}

export const Route = createFileRoute('/')({
  component: HomePage,
})

const stack = [
  { title: '运行时', detail: 'Bun + ElysiaJS + TypeBox' },
  { title: '数据层', detail: 'Drizzle ORM + postgres.js' },
  { title: '基础设施', detail: 'Redis · BullMQ · S3 兼容存储' },
  { title: '前端', detail: 'React 19 + TanStack Router + Tailwind 4' },
]

function HomePage() {
  const [info, setInfo] = useState<ServiceInfo | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    api.info
      .get()
      .then((res) => {
        if (cancelled) return
        if (res.error) {
          setStatus('error')
          return
        }
        setInfo(res.data as ServiceInfo)
        setStatus('ok')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-sm text-brand-700">
          <span className="h-2 w-2 rounded-full bg-brand-500" />
          Yongstack · 通用模板
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          领域无关的全栈应用模板
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-slate-600">
          已完成 monorepo、API、前端、认证、Session、队列、数据库与可观测性接线。新增业务域只需在
          domains / usecases 中增量实现，不需要改基础架构。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stack.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-sm font-semibold text-slate-500">{item.title}</h2>
            <p className="mt-2 text-base font-medium">{item.detail}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">App API</h2>
            <p className="mt-1 text-sm text-slate-500">
              通过 Eden treaty 调用后端，验证前后端类型契约已打通。
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              status === 'ok'
                ? 'bg-emerald-50 text-emerald-700'
                : status === 'error'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {status === 'loading' ? '检测中…' : status === 'ok' ? 'API 正常' : 'API 不可达'}
          </span>
        </div>
        {info ? (
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-slate-500">service</dt>
              <dd className="mt-1 font-mono text-slate-900">{info.service}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-slate-500">version</dt>
              <dd className="mt-1 font-mono text-slate-900">{info.version}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-slate-500">runtime</dt>
              <dd className="mt-1 font-mono text-slate-900">{info.runtime}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </div>
  )
}
