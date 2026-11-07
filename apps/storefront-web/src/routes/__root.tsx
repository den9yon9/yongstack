import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-bold text-white">
              N
            </span>
            <span className="text-lg font-semibold tracking-tight">Nestup</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-slate-600">
            <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700">
              工程底座
            </span>
            <a className="hover:text-brand-600" href="/docs" target="_blank" rel="noreferrer">
              API 文档
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 md:px-6">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        Nestup · 租房平台
      </footer>
    </div>
  )
}
