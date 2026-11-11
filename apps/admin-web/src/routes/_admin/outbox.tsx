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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@yongstack/ui/components/dialog'
import { Input } from '@yongstack/ui/components/input'
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
import type { AdminOutboxEvent, AdminOutboxStats, AdminQueue } from '../../libs/api/types'

export const Route = createFileRoute('/_admin/outbox')({
  component: OutboxPage,
})

const PAGE_SIZE = 20

const STATUS_OPTIONS = ['all', 'pending', 'processing', 'delivered', 'failed'] as const
type StatusFilter = (typeof STATUS_OPTIONS)[number]

type OutboxStatus = AdminOutboxEvent['status']

function statusVariant(status: OutboxStatus) {
  switch (status) {
    case 'delivered':
      return 'default' as const
    case 'failed':
      return 'destructive' as const
    case 'processing':
      return 'outline' as const
    default:
      return 'secondary' as const
  }
}

function OutboxPage() {
  const [items, setItems] = useState<AdminOutboxEvent[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [typeInput, setTypeInput] = useState('')
  const [type, setType] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [stats, setStats] = useState<AdminOutboxStats | null>(null)
  const [queues, setQueues] = useState<AdminQueue[]>([])
  const [target, setTarget] = useState<AdminOutboxEvent | null>(null)
  const [replaying, setReplaying] = useState(false)
  const [bulkReplaying, setBulkReplaying] = useState(false)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    const res = await api.admin.outbox.get({
      query: {
        page,
        pageSize: PAGE_SIZE,
        ...(status === 'all' ? {} : { status }),
        ...(type ? { type } : {}),
      },
    })
    setLoading(false)
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '加载事件失败')
      return
    }
    setItems(res.data.items)
    setTotal(res.data.total)
  }, [page, status, type])

  const loadStats = useCallback(async () => {
    const res = await api.admin.outbox.stats.get()
    if (res.error === null) setStats(res.data)
  }, [])

  const loadQueues = useCallback(async () => {
    const res = await api.admin.queues.get()
    if (res.error === null) setQueues(res.data.items)
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    void loadStats()
    void loadQueues()
  }, [loadStats, loadQueues])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setType(typeInput.trim())
  }

  async function replayAllFailed() {
    setBulkReplaying(true)
    setMessage(null)
    const res = await api.admin.outbox['replay-failed'].post(undefined, {
      query: { limit: 100 },
    })
    setBulkReplaying(false)
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '批量重放失败')
      return
    }
    setMessage(`已重放 ${res.data.replayed} 条失败事件`)
    await Promise.all([loadEvents(), loadStats()])
  }

  async function replay() {
    if (!target) return
    setReplaying(true)
    setMessage(null)
    const res = await api.admin.outbox({ id: target.id }).replay.post({} as never)
    setReplaying(false)
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '重放失败')
      return
    }
    setTarget(null)
    setMessage('重放成功，事件已回到待投递队列')
    await Promise.all([loadEvents(), loadStats()])
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const statItems: { label: string; value: number | string }[] = stats
    ? [
        { label: '待投递', value: stats.pending },
        { label: '处理中', value: stats.processing },
        { label: '已投递', value: stats.delivered },
        { label: '失败', value: stats.failed },
        { label: '总计', value: stats.total },
        {
          label: '最久待投递',
          value:
            stats.oldestPendingAgeSeconds === null
              ? '—'
              : `${Math.floor(stats.oldestPendingAgeSeconds / 60)} 分钟`,
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-6">
      {statItems.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {statItems.map((item) => (
            <Card key={item.label} size="sm">
              <CardHeader>
                <CardDescription>{item.label}</CardDescription>
                <CardTitle className="text-2xl">{item.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold">队列</h2>
          </CardTitle>
          <CardDescription>BullMQ email 队列各状态 job 数量。</CardDescription>
        </CardHeader>
        <CardContent>
          {queues.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无队列数据</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {queues.map((queue) => (
                <div key={queue.name} className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{queue.name}</Badge>
                  {Object.entries(queue.counts).map(([state, count]) => (
                    <Badge key={state} variant={state === 'failed' ? 'destructive' : 'secondary'}>
                      {state}: {count}
                    </Badge>
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <PageHeader
            title="事件队列"
            description="outbox 领域事件与投递状态；failed 事件可手动重放。"
            actions={
              <form onSubmit={submitSearch} className="flex items-center gap-2">
                <Input
                  value={typeInput}
                  onChange={(e) => setTypeInput(e.target.value)}
                  placeholder="按类型筛选"
                  className="w-56"
                />
                <Button type="submit" size="sm">
                  搜索
                </Button>
              </form>
            }
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {message ? (
            <Alert variant={message.includes('成功') ? 'default' : 'destructive'}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={status === option ? 'default' : 'outline'}
                onClick={() => {
                  setStatus(option)
                  setPage(1)
                }}
              >
                {option === 'all' ? '全部' : option}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              disabled={bulkReplaying || (stats?.failed ?? 0) === 0}
              onClick={() => void replayAllFailed()}
            >
              {bulkReplaying ? '重放中…' : '重放全部失败'}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>请求 ID</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>尝试</TableHead>
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
                    <EmptyState title="暂无事件" description="领域事件产生后会出现在这里。" />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{event.type}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(event.status)}>{event.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{event.attempts}</TableCell>
                    <TableCell className="max-w-xs whitespace-normal text-xs text-muted-foreground">
                      {event.lastError ? (
                        <span className="line-clamp-2">{event.lastError}</span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {event.status === 'failed' ? (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => {
                            setMessage(null)
                            setTarget(event)
                          }}
                        >
                          重放
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          共 {total} 条 · 第 {page}/{pageCount} 页
        </span>
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                text="上一页"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                text="下一页"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                className={page >= pageCount ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重放事件</DialogTitle>
            <DialogDescription>
              将 failed 事件 {target?.type} 复位为 pending 并重新投递，确定继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={replaying}>
              取消
            </Button>
            <Button onClick={() => void replay()} disabled={replaying}>
              {replaying ? <Spinner /> : null}
              确认重放
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
