import { createFileRoute, Link } from '@tanstack/react-router'
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

type AdminModule = {
  title: string
  detail: string
  to?: '/users' | '/roles' | '/settings'
}

const modules: AdminModule[] = [
  { title: '用户管理', detail: '账号、状态与角色分配', to: '/users' },
  { title: '角色权限', detail: '角色、权限与访问控制', to: '/roles' },
  { title: '系统设置', detail: '运行时配置与功能开关', to: '/settings' },
  { title: '文件管理', detail: '上传、元数据与附件关联' },
  { title: '审计日志', detail: '关键操作与变更留痕' },
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
              Yongstack 通用模板，平台能力将在后续里程碑接入。
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
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs ${
                  item.to ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {item.to ? '可用' : '待开发'}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">{item.detail}</p>
            {item.to ? (
              <Link
                to={item.to}
                className="mt-3 inline-block text-sm text-brand-600 hover:underline"
              >
                进入
              </Link>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  )
}
