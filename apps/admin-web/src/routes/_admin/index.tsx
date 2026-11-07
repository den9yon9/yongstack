import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { api } from '../../libs/api/client'

interface ServiceInfo {
  service: string
  version: string
  runtime: string
}

export const Route = createFileRoute('/_admin/')({
  component: DashboardPage,
})

const modules = [
  { title: '房源管理', detail: '房源、图片、价格与可租状态' },
  { title: '租约管理', detail: '签约、续租、退租与合同状态' },
  { title: '租客管理', detail: '租客资料、实名与信用信息' },
  { title: '财务对账', detail: '租金账单、押金与收款流水' },
]

function DashboardPage() {
  const { adminUser } = Route.useRouteContext()
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
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">欢迎，{adminUser.name ?? adminUser.email}</h2>
            <p className="mt-1 text-sm text-slate-500">
              管理端后端已就绪，业务路由将在后续提交接入。
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
          <p className="mt-4 font-mono text-sm text-slate-600">
            {info.service} · v{info.version} · {info.runtime}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {modules.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-dashed border-slate-300 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{item.title}</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
                待开发
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">{item.detail}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
