import { type RequestMeta, requestMeta } from '@yongstack/shared'
import type { Cookie } from 'elysia'

import { type SessionStore, setSessionCookie } from './sessionPlugin'

export function sessionCookieFrom(cookie: unknown, name: string): Cookie<unknown> | undefined {
  return (cookie as Record<string, Cookie<unknown> | undefined>)[name]
}

// 登录/注册成功后的会话签发: 组装根(apps)持 cookie/redis 接线, 这里保持领域无关
// (roles/permissions 是普通数组, 不 import 具体领域包)。
export interface StartSessionOptions {
  userId: string
  roles: string[]
  permissions: string[]
  cookie: unknown
  request: Request
  sessionStore: SessionStore
  sessionCookieName: string
  isProduction: boolean
  // 透传给 requestMeta: 仅可信代理后解析转发头里的 IP
  trustProxy?: boolean
}

export async function startSession(options: StartSessionOptions): Promise<void> {
  const meta: RequestMeta = requestMeta(options.request, { trustProxy: options.trustProxy })
  const sessionId = await options.sessionStore.create({
    userId: options.userId,
    roles: options.roles,
    permissions: options.permissions,
    userAgent: meta.userAgent,
    ip: meta.ip,
  })
  setSessionCookie(
    sessionCookieFrom(options.cookie, options.sessionCookieName),
    sessionId,
    options.isProduction,
  )
}
