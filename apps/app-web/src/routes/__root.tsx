import { createRootRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
import { LogOutIcon } from 'lucide-react'
import { useEffect } from 'react'

import { Button, buttonVariants } from '@yongstack/ui/components/button'

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
    <div className="flex min-h-svh flex-col bg-muted/30 text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-lg bg-primary font-bold text-primary-foreground"
            >
              Y
            </span>
            <span className="text-lg font-semibold tracking-tight">Yongstack</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <a
              className="hidden rounded-md px-2 py-1 text-muted-foreground hover:text-foreground sm:block"
              href="/docs"
              target="_blank"
              rel="noreferrer"
            >
              API 文档
            </a>
            {session ? (
              <>
                <Link to="/me" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  {session.name ?? session.email ?? session.phone ?? '用户'}
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void logout().then(() => navigate({ to: '/', replace: true }))}
                >
                  <LogOutIcon data-icon="inline-start" />
                  退出
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  登录
                </Link>
                <Link to="/register" className={buttonVariants({ size: 'sm' })}>
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
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Yongstack · 个人全栈技术栈模板
      </footer>
    </div>
  )
}
