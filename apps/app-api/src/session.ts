import type { UserAccess } from '@yongstack/rbac'
import { type SessionStore, setSessionCookie } from '@yongstack/session'
import type { Cookie } from 'elysia'

export function sessionCookieFrom(cookie: unknown, name: string): Cookie<unknown> | undefined {
  return (cookie as Record<string, Cookie<unknown> | undefined>)[name]
}

export function requestMeta(request: Request): { userAgent: string | null; ip: string | null } {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip')
  return {
    userAgent: request.headers.get('user-agent'),
    ip,
  }
}

export interface StartSessionOptions {
  userId: string
  access: UserAccess
  cookie: unknown
  request: Request
  sessionStore: SessionStore
  sessionCookieName: string
  isProduction: boolean
}

export async function startSession(options: StartSessionOptions): Promise<void> {
  const meta = requestMeta(options.request)
  const sessionId = await options.sessionStore.create({
    userId: options.userId,
    roles: options.access.roles,
    permissions: options.access.permissions,
    userAgent: meta.userAgent,
    ip: meta.ip,
  })
  setSessionCookie(
    sessionCookieFrom(options.cookie, options.sessionCookieName),
    sessionId,
    options.isProduction,
  )
}
