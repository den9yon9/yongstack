import { createRootRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { logout, refreshSession, useSession } from '../libs/api/session'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const navigate = useNavigate()
  const session = useSession()

  useEffect(() => {
    void refreshSession()
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-bold text-white">
              Y
            </span>
            <span className="text-lg font-semibold tracking-tight">Yongstack</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <a className="hover:text-brand-600" href="/docs" target="_blank" rel="noreferrer">
              API 文档
            </a>
            {session ? (
              <>
                <Link to="/me" className="font-medium text-slate-900 hover:text-brand-600">
                  {session.name ?? session.email}
                </Link>
                <button
                  onClick={() => void logout().then(() => navigate({ to: '/', replace: true }))}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50"
                >
                  退出
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:text-brand-600">
                  登录
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700"
                >
                  注册
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 md:px-6">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        Yongstack · 个人全栈技术栈模板
      </footer>
    </div>
  )
}
