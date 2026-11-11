import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Alert, AlertDescription } from '@yongstack/ui/components/alert'
import { Badge } from '@yongstack/ui/components/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@yongstack/ui/components/card'

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
  to?: '/users' | '/roles' | '/files' | '/outbox' | '/queues' | '/audit-logs' | '/settings'
}

const modules: AdminModule[] = [
  { title: '用户管理', detail: '账号、状态与角色分配', to: '/users' },
  { title: '角色权限', detail: '角色、权限与访问控制', to: '/roles' },
  { title: '媒体资源', detail: '文件上传、预览与下载', to: '/files' },
  { title: '事件队列', detail: 'outbox 事件、投递状态与重放', to: '/outbox' },
  { title: '队列运维', detail: 'job 重试、失败详情与计划任务', to: '/queues' },
  { title: '审计日志', detail: '关键操作与变更留痕', to: '/audit-logs' },
  { title: '系统设置', detail: '运行时配置与功能开关', to: '/settings' },
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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold">欢迎，{adminUser.name ?? adminUser.email}</h2>
          </CardTitle>
          <CardDescription>Yongstack 通用模板，平台能力将在后续里程碑接入。</CardDescription>
          <CardAction>
            <Badge
              variant={
                status === 'ok' ? 'default' : status === 'error' ? 'destructive' : 'secondary'
              }
            >
              {status === 'loading' ? '检测中…' : status === 'ok' ? 'API 正常' : 'API 不可达'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {info ? (
            <p className="font-mono text-sm text-muted-foreground">
              {info.service} · v{info.version} · {info.runtime}
            </p>
          ) : (
            <Alert>
              <AlertDescription>正在检测 API 状态。</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {modules.map((item) => (
          <Card key={item.title} className="border-dashed">
            <CardHeader>
              <CardTitle>
                <h3 className="text-base font-semibold">{item.title}</h3>
              </CardTitle>
              <CardDescription>{item.detail}</CardDescription>
              <CardAction>
                <Badge variant={item.to ? 'secondary' : 'outline'}>
                  {item.to ? '可用' : '待开发'}
                </Badge>
              </CardAction>
            </CardHeader>
            {item.to ? (
              <CardContent>
                <Link to={item.to} className="text-sm text-primary hover:underline">
                  进入
                </Link>
              </CardContent>
            ) : null}
          </Card>
        ))}
      </section>
    </div>
  )
}
