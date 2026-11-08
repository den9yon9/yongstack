import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

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
import { Checkbox } from '@yongstack/ui/components/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@yongstack/ui/components/dialog'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@yongstack/ui/components/field'
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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold">用户管理</h2>
          </CardTitle>
          <CardDescription>查看用户、分配角色、启用/禁用与撤销会话。</CardDescription>
          <CardAction>
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索邮箱或昵称"
                className="w-48"
              />
              <Button type="submit" size="sm">
                搜索
              </Button>
            </form>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {message ? (
            <Alert variant={message === '保存成功' ? 'default' : 'destructive'}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
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
                    <EmptyState title="暂无用户" description="符合搜索条件的用户会显示在这里。" />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="whitespace-normal">
                      <p className="font-medium">{user.name ?? '未设置昵称'}</p>
                      <p className="text-xs text-muted-foreground">{user.email ?? '未绑定邮箱'}</p>
                      {user.phone ? (
                        <p className="text-xs text-muted-foreground">
                          {user.phone}
                          {user.phoneVerifiedAt ? ' · 已验证' : ' · 未验证'}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <Badge key={role} variant="secondary">
                              {role}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'default' : 'destructive'}>
                        {user.isActive ? '启用' : '禁用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="link" size="sm" onClick={() => setEditing(user)}>
                          编辑
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => void revokeSessions(user)}
                        >
                          撤销会话
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
          共 {total} 个用户 · 第 {page}/{pageCount} 页
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

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑 {editing?.email ?? editing?.phone ?? editing?.id ?? ''}</DialogTitle>
            <DialogDescription>调整角色与账号状态，保存后立即生效。</DialogDescription>
          </DialogHeader>
          {editing ? (
            <UserEditor
              user={editing}
              roles={roles}
              onCancel={() => setEditing(null)}
              onSave={(nextRoles, isActive) => void saveUser(editing, nextRoles, isActive)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
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

  function toggleRole(code: string, checked: boolean) {
    setSelectedRoles((current) =>
      checked ? [...current, code] : current.filter((role) => role !== code),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FieldSet>
        <FieldLegend variant="label">角色</FieldLegend>
        <FieldGroup>
          {roles.map((role) => (
            <Field key={role.code} orientation="horizontal">
              <Checkbox
                id={`role-${role.code}`}
                checked={selectedRoles.includes(role.code)}
                onCheckedChange={(checked) => toggleRole(role.code, checked)}
              />
              <FieldLabel htmlFor={`role-${role.code}`}>
                {role.name}（{role.code}）
              </FieldLabel>
            </Field>
          ))}
          <Field orientation="horizontal">
            <Checkbox
              id="user-active"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked)}
            />
            <FieldLabel htmlFor="user-active">启用账号</FieldLabel>
          </Field>
        </FieldGroup>
      </FieldSet>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button
          type="button"
          onClick={() => onSave(selectedRoles, isActive)}
          disabled={selectedRoles.length === 0}
        >
          保存
        </Button>
      </DialogFooter>
    </div>
  )
}
