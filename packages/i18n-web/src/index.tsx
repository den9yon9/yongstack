'use client'

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'

export type WebLocale = 'en' | 'zh-CN'

type Messages = Record<string, string>

const CATALOGS: Record<WebLocale, Messages> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.users': 'Users',
    'nav.roles': 'Roles',
    'nav.files': 'Media',
    'nav.outbox': 'Outbox',
    'nav.queues': 'Queues',
    'nav.audit': 'Audit',
    'nav.settings': 'Settings',
    'common.logout': 'Log out',
    'common.login': 'Log in',
    'common.register': 'Sign up',
    'common.docs': 'API docs',
    'app.adminTitle': 'Yongstack Admin',
    'app.adminSubtitle': 'Admin console',
    'app.footer': 'Yongstack · full-stack template',
  },
  'zh-CN': {
    'nav.dashboard': '控制台',
    'nav.users': '用户',
    'nav.roles': '角色',
    'nav.files': '媒体资源',
    'nav.outbox': '事件队列',
    'nav.queues': '队列运维',
    'nav.audit': '审计',
    'nav.settings': '设置',
    'common.logout': '退出',
    'common.login': '登录',
    'common.register': '注册',
    'common.docs': 'API 文档',
    'app.adminTitle': 'Yongstack 管理后台',
    'app.adminSubtitle': '管理后台',
    'app.footer': 'Yongstack · 个人全栈技术栈模板',
  },
}

const STORAGE_KEY = 'yongstack:locale'

interface I18nContextValue {
  locale: WebLocale
  setLocale: (locale: WebLocale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function readStoredLocale(fallback: WebLocale): WebLocale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'zh-CN') return saved
  } catch {
    // SSR/隐私模式
  }
  return fallback
}

export function I18nProvider({
  children,
  defaultLocale = 'zh-CN',
}: {
  children: ReactNode
  defaultLocale?: WebLocale
}) {
  const [locale, setLocale] = useState<WebLocale>(() => readStoredLocale(defaultLocale))

  useEffect(() => {
    document.documentElement.lang = locale
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // ignore
    }
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => {
        const template = CATALOGS[locale][key] ?? CATALOGS.en[key] ?? key
        if (params === undefined) return template
        return Object.entries(params).reduce(
          (text, [name, param]) => text.replaceAll(`{${name}}`, String(param)),
          template,
        )
      },
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within I18nProvider')
  return context
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'en' ? 'zh-CN' : 'en')}
      className="rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
      aria-label="Switch language"
    >
      {locale === 'en' ? '中文' : 'EN'}
    </button>
  )
}
