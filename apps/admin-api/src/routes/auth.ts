import { getUserAccess, type UserAccess } from '@yongstack/rbac'
import { clearSessionCookie, type SessionStore, setSessionCookie } from '@yongstack/session'
import { assertNever, ErrorResponse } from '@yongstack/shared'
import { getUserById, loginUser } from '@yongstack/user'
import * as UserModel from '@yongstack/user/model'
import { type Cookie, Elysia, status } from 'elysia'

import { type AdminPlugins } from '../plugins'

function sessionCookieFrom(cookie: unknown, name: string): Cookie<unknown> | undefined {
  return (cookie as Record<string, Cookie<unknown> | undefined>)[name]
}

function requestMeta(request: Request): { userAgent: string | null; ip: string | null } {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip')
  return { userAgent: request.headers.get('user-agent'), ip }
}

interface StartSessionOptions {
  userId: string
  access: UserAccess
  cookie: unknown
  request: Request
  sessionStore: SessionStore
  sessionCookieName: string
  isProduction: boolean
}

async function startSession(options: StartSessionOptions): Promise<void> {
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

export function createAuthRoutes(plugins: AdminPlugins) {
  const { dbPlugin, sessionPlugin, authRateLimit, isProduction, sessionCookieName } = plugins
  const { authRateLimitPerMinute } = plugins

  return new Elysia({ name: 'auth-admin', prefix: '/auth' })
    .use(plugins.localePlugin)
    .use(dbPlugin)
    .use(sessionPlugin)
    .use(authRateLimit)
    .post(
      '/login',
      async ({ body, cookie, db, sessionStore, request, i18n }) => {
        const result = await loginUser(body, db)
        if (result.isErr()) {
          switch (result.error) {
            case 'LOGIN_FAILED':
              return status(401, {
                error: result.error,
                message: i18n('Invalid email or password'),
              })
            case 'ACCOUNT_DISABLED':
              return status(403, { error: result.error, message: i18n('Account is disabled') })
            default:
              return assertNever(result.error)
          }
        }

        const user = result.value
        const access = await getUserAccess(user.id, db)
        if (!access.roles.includes('admin')) {
          return status(403, {
            error: 'FORBIDDEN',
            message: i18n('Account is not an administrator'),
          })
        }

        await startSession({
          userId: user.id,
          access,
          cookie,
          request,
          sessionStore,
          sessionCookieName,
          isProduction,
        })
        return { ...user, ...access }
      },
      {
        body: UserModel.LoginInputSchema,
        rateLimit: { limit: authRateLimitPerMinute, window: '60s' },
        response: {
          200: UserModel.AuthUserResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
        },
        detail: {
          tags: ['Auth'],
          summary: '管理员登录',
          description: `管理员登录，成功后设置签名 session cookie。\n\n- 凭据错误返回 401\n- 仅 admin 角色可登录，否则返回 403\n- 限流：60 秒内最多 ${authRateLimitPerMinute} 次尝试`,
        },
      },
    )
    .post(
      '/logout',
      async ({ cookie, session, sessionStore }) => {
        const sessionCookie = sessionCookieFrom(cookie, sessionCookieName)
        if (session) {
          const sid = sessionCookie?.value
          if (typeof sid === 'string' && sid.length > 0) {
            await sessionStore.destroy(sid)
          }
        }
        clearSessionCookie(sessionCookie, isProduction)
        return status(204)
      },
      {
        detail: {
          tags: ['Auth'],
          summary: '退出登录',
          description: '销毁当前 session 并清除 cookie。\n\n- 成功返回 204 无返回体',
        },
      },
    )
    .get(
      '/me',
      async ({ session, db, i18n }) => {
        const result = await getUserById(session.userId, db)
        if (result.isErr()) {
          switch (result.error) {
            case 'USER_NOT_FOUND':
              return status(404, { error: result.error, message: i18n('User not found') })
            default:
              return assertNever(result.error)
          }
        }
        const user = result.value
        if (!user.isActive) {
          return status(403, { error: 'ACCOUNT_DISABLED', message: i18n('Account is disabled') })
        }
        const access = await getUserAccess(session.userId, db)
        if (!access.roles.includes('admin')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        return { ...user, ...access }
      },
      {
        isAdmin: true,
        response: {
          200: UserModel.AuthUserResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
        },
        detail: {
          tags: ['Auth'],
          summary: '当前管理员信息',
          description: '获取当前登录管理员的信息与 roles/permissions。\n\n- 需要 admin 角色',
        },
      },
    )
}
