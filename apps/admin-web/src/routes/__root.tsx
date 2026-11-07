import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
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
          <Link
            to="/"
            className="block rounded-lg bg-brand-50 px-3 py-2 font-medium text-brand-700"
          >
            控制台
          </Link>
          {['房源管理', '租约管理', '租客管理', '财务对账'].map((label) => (
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
          <a
            className="text-sm text-brand-600 hover:text-brand-700"
            href="/docs"
            target="_blank"
            rel="noreferrer"
          >
            API 文档
          </a>
        </header>
        <main className="flex-1 p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
