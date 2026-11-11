import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

import { EmptyState, PageHeader } from '@yongstack/ui'
import { Alert, AlertDescription } from '@yongstack/ui/components/alert'
import { Badge } from '@yongstack/ui/components/badge'
import { Button } from '@yongstack/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@yongstack/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@yongstack/ui/components/dialog'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@yongstack/ui/components/pagination'
import { Spinner } from '@yongstack/ui/components/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@yongstack/ui/components/table'

import { api } from '../../libs/api/client'
import type {
  AdminQueue,
  AdminQueueJob,
  AdminQueueJobDetail,
  AdminQueueScheduler,
} from '../../libs/api/types'

export const Route = createFileRoute('/_admin/queues')({
  component: QueuesPage,
})

const PAGE_SIZE = 20
const STATES = ['failed', 'waiting', 'active', 'delayed', 'completed'] as const
type JobState = (typeof STATES)[number]

function stateVariant(state: string) {
  if (state === 'failed') return 'destructive' as const
  if (state === 'completed') return 'default' as const
  if (state === 'active') return 'outline' as const
  return 'secondary' as const
}

function formatTime(value: number | null): string {
  if (value === null) return '—'
  return new Date(value).toLocaleString()
}

function QueuesPage() {
  const [queues, setQueues] = useState<AdminQueue[]>([])
  const [selected, setSelected] = useState<string>('')
  const [state, setState] = useState<JobState>('failed')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AdminQueueJob[]>([])
  const [total, setTotal] = useState(0)
  const [schedulers, setSchedulers] = useState<AdminQueueScheduler[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminQueueJobDetail | null>(null)

  const loadOverview = useCallback(async () => {
    const res = await api.admin.queues.get()
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '加载队列失败')
      return
    }
    setQueues(res.data.items)
    setSelected((current) => current || (res.data.items[0]?.name ?? ''))
  }, [])

  const loadJobs = useCallback(async () => {
    if (!selected) return
    setLoading(true)
    const res = await api.admin.queues({ name: selected }).jobs.get({
      query: { state, page, pageSize: PAGE_SIZE },
    })
    setLoading(false)
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '加载 job 失败')
      return
    }
    setItems(res.data.items)
    setTotal(res.data.total)
  }, [selected, state, page])

  const loadSchedulers = useCallback(async () => {
    if (!selected) return
    const res = await api.admin.queues({ name: selected }).schedulers.get()
    if (res.error === null) setSchedulers(res.data.items)
  }, [selected])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  useEffect(() => {
    void loadJobs()
    void loadSchedulers()
  }, [loadJobs, loadSchedulers])

  async function openDetail(job: AdminQueueJob) {
    if (!selected || job.id === null) return
    setMessage(null)
    const res = await api.admin.queues({ name: selected }).jobs({ id: job.id }).get()
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '加载 job 详情失败')
      return
    }
    setDetail(res.data)
  }

  async function act(job: AdminQueueJob, action: 'retry' | 'promote' | 'remove') {
    if (!selected || job.id === null) return
    setBusyId(job.id)
    setMessage(null)
    const path = api.admin.queues({ name: selected }).jobs({ id: job.id })
    const res =
      action === 'retry'
        ? await path.retry.post({} as never)
        : action === 'promote'
          ? await path.promote.post({} as never)
          : await path.delete(undefined)
    setBusyId(null)
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '操作失败')
      return
    }
    setMessage(action === 'retry' ? '已重新入队' : action === 'promote' ? '已提升' : '已删除')
    await Promise.all([loadJobs(), loadOverview()])
  }

  async function runScheduler(scheduler: AdminQueueScheduler) {
    if (!selected) return
    const id = scheduler.id ?? scheduler.key
    const res = await api.admin
      .queues({ name: selected })
      .schedulers({ id })
      .run.post({} as never)
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '触发失败')
      return
    }
    setMessage(res.data.jobId ? `已创建任务 ${res.data.jobId}` : '已触发')
    await loadJobs()
  }

  async function removeScheduler(scheduler: AdminQueueScheduler) {
    if (!selected) return
    const id = scheduler.id ?? scheduler.key
    const res = await api.admin.queues({ name: selected }).schedulers({ id }).delete(undefined)
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '删除计划失败')
      return
    }
    setMessage('计划已删除')
    await loadSchedulers()
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <PageHeader
            title="队列运维"
            description="查看队列计数、失败 job、重试/删除，以及维护计划任务。"
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {message ? (
            <Alert variant={message.includes('已') ? 'default' : 'destructive'}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {queues.map((queue) => (
              <button
                key={queue.name}
                type="button"
                onClick={() => {
                  setSelected(queue.name)
                  setPage(1)
                }}
                className={`rounded-lg border p-3 text-left transition ${
                  selected === queue.name ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <p className="font-mono text-sm font-semibold">{queue.name}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(queue.counts)
                    .filter(([, count]) => count > 0)
                    .map(([key, count]) => (
                      <Badge key={key} variant={key === 'failed' ? 'destructive' : 'secondary'}>
                        {key}: {count}
                      </Badge>
                    ))}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold">Job 列表</h2>
          </CardTitle>
          <CardDescription>按状态查看 job；失败 job 可重试或删除。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {STATES.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={state === option ? 'default' : 'outline'}
                onClick={() => {
                  setState(option)
                  setPage(1)
                }}
              >
                {option}
              </Button>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>尝试</TableHead>
                <TableHead>时间</TableHead>
                <TableHead>错误</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Spinner />
                      加载中…
                    </span>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState title="暂无 job" description="切换状态或等待任务产生。" />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((job) => (
                  <TableRow key={job.id ?? `${job.name}-${job.timestamp}`}>
                    <TableCell className="font-mono text-xs">{job.id ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{job.name}</TableCell>
                    <TableCell>
                      <Badge variant={stateVariant(job.state)}>{job.state}</Badge>
                    </TableCell>
                    <TableCell>{job.attemptsMade}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTime(job.timestamp)}
                    </TableCell>
                    <TableCell className="max-w-72 truncate text-xs text-muted-foreground">
                      {job.failedReason ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="link" size="sm" onClick={() => void openDetail(job)}>
                          详情
                        </Button>
                        {job.state === 'failed' ? (
                          <Button
                            variant="link"
                            size="sm"
                            disabled={busyId === job.id}
                            onClick={() => void act(job, 'retry')}
                          >
                            重试
                          </Button>
                        ) : null}
                        {job.state === 'delayed' ? (
                          <Button
                            variant="link"
                            size="sm"
                            disabled={busyId === job.id}
                            onClick={() => void act(job, 'promote')}
                          >
                            提升
                          </Button>
                        ) : null}
                        <Button
                          variant="link"
                          size="sm"
                          className="text-destructive"
                          disabled={busyId === job.id}
                          onClick={() => void act(job, 'remove')}
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  text="上一页"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-3 text-sm text-muted-foreground">
                  {page} / {pageCount}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  text="下一页"
                  onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                  className={page >= pageCount ? 'pointer-events-none opacity-50' : undefined}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold">计划任务</h2>
          </CardTitle>
          <CardDescription>维护队列的 cron scheduler；可立即执行一次或删除。</CardDescription>
        </CardHeader>
        <CardContent>
          {schedulers.length === 0 ? (
            <p className="text-sm text-muted-foreground">当前队列没有计划任务。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>cron</TableHead>
                  <TableHead>下次执行</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedulers.map((scheduler) => (
                  <TableRow key={scheduler.key}>
                    <TableCell className="font-mono text-xs">{scheduler.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {scheduler.pattern ?? `${scheduler.every ?? '—'}ms`}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTime(scheduler.next)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => void runScheduler(scheduler)}
                        >
                          运行一次
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-destructive"
                          onClick={() => void removeScheduler(scheduler)}
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Job 详情</DialogTitle>
            <DialogDescription>payload、失败原因与堆栈。</DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="flex flex-col gap-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-xs">{detail.id ?? '—'}</span>
                <span className="text-muted-foreground">名称</span>
                <span className="font-mono text-xs">{detail.name}</span>
                <span className="text-muted-foreground">状态</span>
                <span>
                  <Badge variant={stateVariant(detail.state)}>{detail.state}</Badge>
                </span>
                <span className="text-muted-foreground">尝试</span>
                <span>{detail.attemptsMade}</span>
              </div>
              <div>
                <p className="mb-1 text-muted-foreground">Payload</p>
                <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">
                  {JSON.stringify(detail.data, null, 2)}
                </pre>
              </div>
              {detail.failedReason ? (
                <div>
                  <p className="mb-1 text-muted-foreground">失败原因</p>
                  <pre className="max-h-40 overflow-auto rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                    {detail.failedReason}
                  </pre>
                </div>
              ) : null}
              {detail.stacktrace.length > 0 ? (
                <div>
                  <p className="mb-1 text-muted-foreground">堆栈</p>
                  <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">
                    {detail.stacktrace.join('\n')}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
