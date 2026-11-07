import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

import { EmptyState, PageHeader } from '@yongstack/ui'

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
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <PageHeader
          title="审计日志"
          description="关键管理操作留痕：动作、对象、操作人与请求上下文。"
          actions={
            <form onSubmit={submitSearch} className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索动作 / 目标 / 关键词"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
                搜索
              </button>
            </form>
          }
        />
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">时间</th>
              <th className="px-4 py-3">动作</th>
              <th className="px-4 py-3">目标</th>
              <th className="px-4 py-3">操作人</th>
              <th className="px-4 py-3">上下文</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  加载中…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState title="暂无审计日志" description="管理操作发生后会出现在这里。" />
                </td>
              </tr>
            ) : (
              items.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {new Date(log.createdAt as string).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-900">{log.action}</td>
                  <td className="px-4 py-3">
                    <p className="text-slate-900">{log.targetType}</p>
                    <p className="font-mono text-xs text-slate-400">{log.targetId ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {log.actorId ?? 'system'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    <p>{log.ip ?? '—'}</p>
                    <p className="truncate">{log.requestId ?? '—'}</p>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          共 {total} 条 · 第 {page}/{pageCount} 页
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
