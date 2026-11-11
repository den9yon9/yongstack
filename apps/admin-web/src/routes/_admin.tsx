import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { LanguageSwitcher, useI18n } from '@yongstack/i18n-web'
import {
  ActivityIcon,
  FileIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  ScrollTextIcon,
  ListChecksIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
} from 'lucide-react'

import { Button } from '@yongstack/ui/components/button'
import { Separator } from '@yongstack/ui/components/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@yongstack/ui/components/sidebar'
import { TooltipProvider } from '@yongstack/ui/components/tooltip'

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
    if (!adminUser || !adminUser.permissions.includes('admin:access')) {
      throw redirect({ to: '/login' })
    }
    return { adminUser }
  },
  component: AdminLayout,
})

const navItems = [
  { labelKey: 'nav.dashboard', to: '/', icon: LayoutDashboardIcon, exact: true },
  { labelKey: 'nav.users', to: '/users', icon: UsersIcon, exact: false },
  { labelKey: 'nav.roles', to: '/roles', icon: ShieldIcon, exact: false },
  { labelKey: 'nav.files', to: '/files', icon: FileIcon, exact: false },
  { labelKey: 'nav.outbox', to: '/outbox', icon: ActivityIcon, exact: false },
  { labelKey: 'nav.queues', to: '/queues', icon: ListChecksIcon, exact: false },
  { labelKey: 'nav.audit', to: '/audit-logs', icon: ScrollTextIcon, exact: false },
  { labelKey: 'nav.settings', to: '/settings', icon: SettingsIcon, exact: false },
] as const

const pendingModules: string[] = []

function AdminLayout() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { adminUser } = Route.useRouteContext()
  const pathname = useLocation({ select: (location) => location.pathname })

  async function handleLogout() {
    await api.auth.logout.post({} as never)
    navigate({ to: '/login', replace: true })
  }

  function isActive(item: (typeof navItems)[number]) {
    return item.exact
      ? pathname === item.to
      : pathname === item.to || pathname.startsWith(`${item.to}/`)
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" render={<Link to="/" />}>
                  <span className="grid size-8 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">
                    Y
                  </span>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold">{t('app.adminTitle')}</span>
                    <span className="text-xs text-muted-foreground">{t('app.adminSubtitle')}</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>导航</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        isActive={isActive(item)}
                        tooltip={t(item.labelKey)}
                        render={<Link to={item.to} />}
                      >
                        <item.icon />
                        <span>{t(item.labelKey)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {pendingModules.map((label) => (
                    <SidebarMenuItem key={label}>
                      <SidebarMenuButton disabled>
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 rounded-md p-2 text-sm">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {(adminUser.name ?? adminUser.email ?? 'A').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {adminUser.name ?? adminUser.email}
                  </span>
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-14 items-center justify-between gap-4 border-b bg-background px-4 md:px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-6" />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold">{t('app.adminTitle')}</h1>
                <p className="truncate text-xs text-muted-foreground">{t('app.adminSubtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-muted-foreground sm:inline">
                {adminUser.name ?? adminUser.email}
              </span>
              <LanguageSwitcher />
              <Button variant="outline" size="sm" onClick={() => void handleLogout()}>
                <LogOutIcon data-icon="inline-start" />
                {t('common.logout')}
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
