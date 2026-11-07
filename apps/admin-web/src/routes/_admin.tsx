import { createFileRoute, Link, Outlet, redirect, useNavigate } from '@tanstack/react-router'

import { api } from '../libs/api/client'
import type { AdminUser } from '../libs/api/types'

export interface AdminContext {
  adminUser: AdminUser
}

async function fetchAdminUser(): Promise<AdminUser | null> {
  const res = await api.auth.me.get()
  return res.error === null ? res.data : null
}

export const Route = createFileRoute('/_admin')({
  beforeLoad: async (): Promise<AdminContext> => {
    const adminUser = await fetchAdminUser()
    if (!adminUser || adminUser.role !== 'admin') {
      throw redirect({ to: '/login' })
    }
    return { adminUser }
  },
  component: AdminLayout,
})

const navItems = ['控制台']
const pendingModules = ['房源管理', '租约管理', '租客管理', '财务对账']

function AdminLayout() {
  const navigate = useNavigate()
  const { adminUser } = Route.useRouteContext()

  async function handleLogout() {
    await api.auth.logout.post({} as never)
    navigate({ to: '/login', replace: true })
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white p-5 md:flex">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-bold text-white">
            N
          </span>
          <span className="text-lg font-semibold tracking-tight">Nestup Admin</span>
        </Link>
        <nav className="mt-8 space-y-1 text-sm">
          {navItems.map((label) => (
            <Link
              key={label}
              to="/"
              className="block rounded-lg bg-brand-50 px-3 py-2 font-medium text-brand-700"
            >
              {label}
            </Link>
          ))}
          {pendingModules.map((label) => (
            <span key={label} className="block rounded-lg px-3 py-2 text-slate-400">
              {label}
            </span>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h1 className="text-base font-semibold">Nestup 管理后台</h1>
            <p className="text-xs text-slate-500">工程底座 · 业务模块待接入</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">{adminUser.name ?? adminUser.email}</span>
            <button
              onClick={() => void handleLogout()}
              className="rounded-lg border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-50"
            >
              退出
            </button>
          </div>
        </header>
        <main className="flex-1 p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
