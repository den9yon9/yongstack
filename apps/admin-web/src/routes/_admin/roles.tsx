import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Alert, AlertDescription } from '@yongstack/ui/components/alert'
import { Badge } from '@yongstack/ui/components/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@yongstack/ui/components/card'
import { Spinner } from '@yongstack/ui/components/spinner'

import { api } from '../../libs/api/client'
import type { AdminRole } from '../../libs/api/types'

export const Route = createFileRoute('/_admin/roles')({
  component: RolesPage,
})

interface PermissionItem {
  code: string
  description: string | null
}

function RolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.admin.roles.get(), api.admin.permissions.get()])
      .then(([rolesRes, permissionsRes]) => {
        if (cancelled) return
        if (rolesRes.error !== null) {
          setError(rolesRes.error.value.message ?? '加载角色失败')
          return
        }
        if (permissionsRes.error !== null) {
          setError(permissionsRes.error.value.message ?? '加载权限失败')
          return
        }
        setRoles(rolesRes.data.items)
        setPermissions(permissionsRes.data.items)
      })
      .catch(() => {
        if (!cancelled) setError('加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg font-semibold">角色权限</h2>
          </CardTitle>
          <CardDescription>
            系统内置角色与权限映射；自定义角色与权限编辑将在后续版本开放。
          </CardDescription>
        </CardHeader>
        {error ? (
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        ) : null}
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <Card>
            <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              加载中…
            </CardContent>
          </Card>
        ) : (
          roles.map((role) => (
            <Card key={role.code}>
              <CardHeader>
                <CardTitle>
                  <h3 className="text-base font-semibold">{role.name}</h3>
                </CardTitle>
                <CardDescription className="font-mono text-xs">{role.code}</CardDescription>
                {role.isSystem ? (
                  <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
                    <Badge variant="secondary">系统</Badge>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{role.description ?? '—'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.map((permission) => (
                    <Badge key={permission} variant="secondary" className="font-mono">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            <h3 className="text-base font-semibold">全部权限</h3>
          </CardTitle>
          <CardDescription>系统当前注册的所有权限码。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {permissions.map((permission) => (
              <div key={permission.code} className="rounded-lg bg-muted/60 px-3 py-2">
                <p className="font-mono text-sm">{permission.code}</p>
                <p className="text-xs text-muted-foreground">{permission.description ?? '—'}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
