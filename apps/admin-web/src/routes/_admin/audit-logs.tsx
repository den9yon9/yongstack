import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

import { EmptyState, PageHeader } from '@yongstack/ui'
import { Alert, AlertDescription } from '@yongstack/ui/components/alert'
import { Button } from '@yongstack/ui/components/button'
import { Card, CardContent, CardHeader } from '@yongstack/ui/components/card'
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
import type { AdminAuditLog } from '../../libs/api/types'

export const Route = createFileRoute('/_admin/audit-logs')({
  component: AuditLogsPage,
})

const PAGE_SIZE = 20

function AuditLogsPage() {
  const [items, setItems] = useState<AdminAuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    const res = await api.admin.audit.get({
      query: { page, pageSize: PAGE_SIZE, ...(search ? { q: search } : {}) },
    })
    setLoading(false)
    if (res.error !== null) {
      setError(res.error.value.message ?? '加载审计日志失败')
      return
    }
    setError(null)
    setItems(res.data.items)
    setTotal(res.data.total)
  }, [page, search])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(query.trim())
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <PageHeader
            title="审计日志"
            description="关键管理操作留痕：动作、对象、操作人与请求上下文。"
            actions={
              <form onSubmit={submitSearch} className="flex items-center gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索动作 / 目标 / 关键词"
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
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>动作</TableHead>
                <TableHead>目标</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>上下文</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Spinner />
                      加载中…
                    </span>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState title="暂无审计日志" description="管理操作发生后会出现在这里。" />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(log.createdAt as string).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.action}</TableCell>
                    <TableCell>
                      <p>{log.targetType}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {log.targetId ?? '—'}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.actorId ?? 'system'}
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-normal text-xs text-muted-foreground">
                      <p>{log.ip ?? '—'}</p>
                      <p className="truncate">{log.requestId ?? '—'}</p>
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
    </div>
  )
}
