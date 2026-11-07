import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

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
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">文件管理</h2>
            <p className="mt-1 text-sm text-slate-500">查看上传文件元数据并软删除。</p>
          </div>
          <form onSubmit={submitSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索 key / mime / purpose"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
              搜索
            </button>
          </form>
        </div>
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">文件</th>
              <th className="px-4 py-3">类型</th>
              <th className="px-4 py-3">大小</th>
              <th className="px-4 py-3">用途</th>
              <th className="px-4 py-3">创建时间</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  加载中…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  暂无文件
                </td>
              </tr>
            ) : (
              items.map((file) => (
                <tr key={file.id}>
                  <td className="max-w-xs px-4 py-3">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate font-mono text-xs text-brand-600 hover:underline"
                    >
                      {file.key}
                    </a>
                    <p className="text-xs text-slate-400">{file.ownerId ?? 'system'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{file.mime}</td>
                  <td className="px-4 py-3 text-slate-600">{formatBytes(file.size)}</td>
                  <td className="px-4 py-3 text-slate-600">{file.purpose}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(file.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void remove(file)}
                      className="text-red-600 hover:underline"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          共 {total} 个文件 · 第 {page}/{pageCount} 页
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
          >
            上一页
          </button>
          <button
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            disabled={page >= pageCount}
            className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  )
}
