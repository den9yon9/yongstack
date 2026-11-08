import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

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
import type { AdminFile } from '../../libs/api/types'

export const Route = createFileRoute('/_admin/files')({
  component: FilesPage,
})

const PAGE_SIZE = 20

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FilesPage() {
  const [items, setItems] = useState<AdminFile[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    const res = await api.admin.files.get({
      query: { page, pageSize: PAGE_SIZE, ...(search ? { q: search } : {}) },
    })
    setLoading(false)
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '加载文件失败')
      return
    }
    setItems(res.data.items)
    setTotal(res.data.total)
  }, [page, search])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(query.trim())
  }

  async function remove(file: AdminFile) {
    setMessage(null)
    const res = await api.admin.files({ id: file.id }).delete(undefined)
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '删除失败')
      return
    }
    setMessage('删除成功')
    await loadFiles()
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold">文件管理</h2>
          </CardTitle>
          <CardDescription>查看上传文件元数据并软删除。</CardDescription>
          <CardAction>
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索 key / mime / purpose"
                className="w-56"
              />
              <Button type="submit" size="sm">
                搜索
              </Button>
            </form>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {message ? (
            <Alert variant={message === '删除成功' ? 'default' : 'destructive'}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文件</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>大小</TableHead>
                <TableHead>用途</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Spinner />
                      加载中…
                    </span>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    暂无文件
                  </TableCell>
                </TableRow>
              ) : (
                items.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="max-w-xs whitespace-normal">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate font-mono text-xs text-primary hover:underline"
                      >
                        {file.key}
                      </a>
                      <p className="text-xs text-muted-foreground">{file.ownerId ?? 'system'}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{file.mime}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatBytes(file.size)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{file.purpose}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(file.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="link"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void remove(file)}
                      >
                        删除
                      </Button>
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
          共 {total} 个文件 · 第 {page}/{pageCount} 页
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
