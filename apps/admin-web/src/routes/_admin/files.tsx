import { createFileRoute } from '@tanstack/react-router'
import { CopyIcon, DownloadIcon, FileTextIcon, UploadIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { EmptyState } from '@yongstack/ui'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { AdminFile } from '../../libs/api/types'

export const Route = createFileRoute('/_admin/files')({
  component: MediaPage,
})

const PAGE_SIZE = 20
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileName(key: string): string {
  return key.split('/').pop() ?? key
}

function MediaPage() {
  const [items, setItems] = useState<AdminFile[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [preview, setPreview] = useState<AdminFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setMessage('文件不能超过 5MB')
      return
    }
    setUploading(true)
    setMessage(null)
    try {
      const presigned = await api.admin.files.presign.post({
        filename: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
      })
      if (presigned.error !== null) {
        setMessage(presigned.error.value.message ?? '申请上传地址失败')
        return
      }

      // 浏览器直传对象存储, 需要 bucket 配置 CORS
      const put = await fetch(presigned.data.uploadUrl, {
        method: 'PUT',
        headers: presigned.data.headers,
        body: file,
      })
      if (!put.ok) {
        setMessage(`上传失败 (${put.status})`)
        return
      }

      const confirmed = await api.admin.files({ id: presigned.data.fileId }).confirm.post({})
      if (confirmed.error !== null) {
        setMessage(confirmed.error.value.message ?? '确认上传失败')
        return
      }

      setMessage('上传成功')
      await loadFiles()
    } catch (error) {
      setMessage(
        error instanceof TypeError
          ? '上传被浏览器跨域策略拦截: 请为存储 bucket 配置 CORS'
          : `上传失败: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setUploading(false)
    }
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

  async function copyUrl(file: AdminFile) {
    await navigator.clipboard.writeText(file.url)
    setMessage('公开 URL 已复制')
  }

  function openFile(file: AdminFile) {
    if (file.mime.startsWith('image/')) {
      setPreview(file)
      return
    }
    window.open(file.url, '_blank', 'noopener,noreferrer')
  }

  function download(file: AdminFile) {
    const link = document.createElement('a')
    link.href = file.url
    link.download = fileName(file.key)
    link.target = '_blank'
    link.rel = 'noreferrer'
    link.click()
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold">媒体资源</h2>
          </CardTitle>
          <CardDescription>
            上传图片 / PDF，查看列表、预览图片、下载或软删除。单文件上限 5MB。
          </CardDescription>
          <CardAction>
            <div className="flex flex-wrap items-center gap-2">
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
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void upload(file)
                  e.target.value = ''
                }}
              />
              <Button size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                <UploadIcon data-icon="inline-start" />
                {uploading ? '上传中…' : '上传文件'}
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {message ? (
            <Alert
              variant={
                message.includes('成功') || message.includes('已复制') ? 'default' : 'destructive'
              }
            >
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
                  <TableCell colSpan={6}>
                    <EmptyState title="暂无文件" description="点击右上角上传第一个文件。" />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="max-w-sm whitespace-normal">
                      <div className="flex items-center gap-3">
                        {file.mime.startsWith('image/') ? (
                          <button
                            type="button"
                            onClick={() => openFile(file)}
                            className="size-10 shrink-0 overflow-hidden rounded-lg border bg-muted"
                          >
                            <img
                              src={file.url}
                              alt={fileName(file.key)}
                              className="size-full object-cover"
                            />
                          </button>
                        ) : (
                          <span className="grid size-10 shrink-0 place-items-center rounded-lg border bg-muted text-muted-foreground">
                            <FileTextIcon className="size-5" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => openFile(file)}
                            className="block max-w-full truncate text-left font-mono text-xs text-primary hover:underline"
                          >
                            {fileName(file.key)}
                          </button>
                          <p className="truncate text-xs text-muted-foreground">
                            {file.ownerId ?? 'system'}
                          </p>
                        </div>
                      </div>
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
                      <div className="flex justify-end gap-1">
                        <Button variant="link" size="sm" onClick={() => openFile(file)}>
                          查看
                        </Button>
                        <Button variant="link" size="sm" onClick={() => void copyUrl(file)}>
                          <CopyIcon data-icon="inline-start" />
                          复制 URL
                        </Button>
                        <Button variant="link" size="sm" onClick={() => download(file)}>
                          <DownloadIcon data-icon="inline-start" />
                          下载
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-destructive"
                          onClick={() => void remove(file)}
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

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate font-mono text-sm">
              {preview ? fileName(preview.key) : ''}
            </DialogTitle>
            <DialogDescription>
              {preview ? `${preview.mime} · ${formatBytes(preview.size)}` : ''}
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <img
              src={preview.url}
              alt={fileName(preview.key)}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
