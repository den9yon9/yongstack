import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

import { api } from '../../libs/api/client'
import type { AdminRole, AdminUserListItem } from '../../libs/api/types'

export const Route = createFileRoute('/_admin/users')({
  component: UsersPage,
})

const PAGE_SIZE = 20

function UsersPage() {
  const [items, setItems] = useState<AdminUserListItem[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<AdminUserListItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const res = await api.admin.users.get({
      query: { page, pageSize: PAGE_SIZE, ...(search ? { q: search } : {}) },
    })
    setLoading(false)
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '加载用户失败')
      return
    }
    setItems(res.data.items)
    setTotal(res.data.total)
  }, [page, search])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    void api.admin.roles.get().then((res) => {
      if (res.error === null) setRoles(res.data.items)
    })
  }, [])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(query.trim())
  }

  async function saveUser(user: AdminUserListItem, nextRoles: string[], isActive: boolean) {
    setMessage(null)
    const res = await api.admin.users({ id: user.id }).patch({ roles: nextRoles, isActive })
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '保存失败')
      return
    }
    setEditing(null)
    setMessage('保存成功')
    await loadUsers()
  }

  async function revokeSessions(user: AdminUserListItem) {
    setMessage(null)
    const res = await api.admin.users({ id: user.id }).sessions.delete(undefined)
    if (res.error !== null) {
      setMessage(res.error.value.message ?? '撤销会话失败')
      return
    }
    setMessage('会话已撤销')
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">用户管理</h2>
            <p className="mt-1 text-sm text-slate-500">查看用户、分配角色、启用/禁用与撤销会话。</p>
          </div>
          <form onSubmit={submitSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索邮箱或昵称"
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
              <th className="px-4 py-3">用户</th>
              <th className="px-4 py-3">角色</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">注册时间</th>
              <th className="px-4 py-3 text-right">操作</th>
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
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  暂无用户
                </td>
              </tr>
            ) : (
              items.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{user.name ?? '未设置昵称'}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">{user.roles.join(', ') || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {user.isActive ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(user)}
                      className="text-brand-600 hover:underline"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => void revokeSessions(user)}
                      className="ml-3 text-slate-500 hover:underline"
                    >
                      撤销会话
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
          共 {total} 个用户 · 第 {page}/{pageCount} 页
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

      {editing ? (
        <UserEditor
          user={editing}
          roles={roles}
          onCancel={() => setEditing(null)}
          onSave={(nextRoles, isActive) => void saveUser(editing, nextRoles, isActive)}
        />
      ) : null}
    </div>
  )
}

function UserEditor({
  user,
  roles,
  onCancel,
  onSave,
}: {
  user: AdminUserListItem
  roles: AdminRole[]
  onCancel: () => void
  onSave: (roles: string[], isActive: boolean) => void
}) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.roles)
  const [isActive, setIsActive] = useState(user.isActive)

  function toggleRole(code: string) {
    setSelectedRoles((current) =>
      current.includes(code) ? current.filter((role) => role !== code) : [...current, code],
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="font-semibold">编辑 {user.email}</h3>
      <div className="mt-4 flex flex-wrap gap-4">
        {roles.map((role) => (
          <label key={role.code} className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedRoles.includes(role.code)}
              onChange={() => toggleRole(role.code)}
              className="h-4 w-4"
            />
            {role.name}（{role.code}）
          </label>
        ))}
      </div>
      <label className="mt-4 inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-4 w-4"
        />
        启用账号
      </label>
      <div className="mt-5 flex gap-2">
        <button
          onClick={() => onSave(selectedRoles, isActive)}
          disabled={selectedRoles.length === 0}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
        >
          保存
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          取消
        </button>
      </div>
    </section>
  )
}
