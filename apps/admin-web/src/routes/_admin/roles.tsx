import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

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
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">角色权限</h2>
        <p className="mt-1 text-sm text-slate-500">
          系统内置角色与权限映射；自定义角色与权限编辑将在后续版本开放。
        </p>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {roles.map((role) => (
          <div
            key={role.code}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{role.name}</h3>
                <p className="font-mono text-xs text-slate-400">{role.code}</p>
              </div>
              {role.isSystem ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
                  系统
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-slate-500">{role.description ?? '—'}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {role.permissions.map((permission) => (
                <span
                  key={permission}
                  className="rounded-full bg-brand-50 px-2 py-0.5 font-mono text-xs text-brand-700"
                >
                  {permission}
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold">全部权限</h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {permissions.map((permission) => (
            <div key={permission.code} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="font-mono text-sm text-slate-900">{permission.code}</p>
              <p className="text-xs text-slate-500">{permission.description ?? '—'}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
