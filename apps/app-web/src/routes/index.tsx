import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Badge } from '@yongstack/ui/components/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@yongstack/ui/components/card'
import { Skeleton } from '@yongstack/ui/components/skeleton'

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
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <Badge variant="outline" className="w-fit gap-1.5">
          <span className="size-2 rounded-full bg-primary" />
          Yongstack · 通用模板
        </Badge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          领域无关的全栈应用模板
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
          已完成 monorepo、API、前端、认证、Session、队列、数据库与可观测性接线。新增业务域只需在
          domains / usecases 中增量实现，不需要改基础架构。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stack.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base font-medium">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold">App API</h2>
          </CardTitle>
          <CardDescription>通过 Eden treaty 调用后端，验证前后端类型契约已打通。</CardDescription>
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
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-muted/60 p-3">
                <dt className="text-muted-foreground">service</dt>
                <dd className="mt-1 font-mono text-foreground">{info.service}</dd>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <dt className="text-muted-foreground">version</dt>
                <dd className="mt-1 font-mono text-foreground">{info.version}</dd>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <dt className="text-muted-foreground">runtime</dt>
                <dd className="mt-1 font-mono text-foreground">{info.runtime}</dd>
              </div>
            </dl>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
