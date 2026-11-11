import { createRootRoute, Link, Outlet, useNavigate, useRouter } from '@tanstack/react-router'
import { LanguageSwitcher, useI18n } from '@yongstack/i18n-web'
import { LogOutIcon } from 'lucide-react'

import { Button, buttonVariants } from '@yongstack/ui/components/button'

import { api } from '../libs/api/client'

// 登录态视图: 服务端 HttpOnly cookie 才是权威, 这里只经 root loader 读一份
// (beforeLoad 每次导航执行), 登录/退出等变更后由 router.invalidate() 触发重取。
// 不再有 localStorage/手写 store 这类第二真相源。
export const Route = createRootRoute({
  beforeLoad: async () => {
    try {
      const res = await api.auth.me.get()
      return { user: res.error === null ? res.data : null }
    } catch {
      return { user: null }
    }
  },
  component: RootLayout,
})

function RootLayout() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const router = useRouter()
  const { user } = Route.useRouteContext()

  async function handleLogout() {
    await api.auth.logout.post({} as never)
    await router.invalidate()
    navigate({ to: '/', replace: true })
  }

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
            <LanguageSwitcher />
            <a
              className="hidden rounded-md px-2 py-1 text-muted-foreground hover:text-foreground sm:block"
              href="/docs"
              target="_blank"
              rel="noreferrer"
            >
              {t('common.docs')}
            </a>
            {user ? (
              <>
                <Link to="/me" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  {user.name ?? user.email ?? user.phone ?? '用户'}
                </Link>
                <Button variant="outline" size="sm" onClick={() => void handleLogout()}>
                  <LogOutIcon data-icon="inline-start" />
                  {t('common.logout')}
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  {t('common.login')}
                </Link>
                <Link to="/register" className={buttonVariants({ size: 'sm' })}>
                  {t('common.register')}
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
        {t('app.footer')}
      </footer>
    </div>
  )
}
