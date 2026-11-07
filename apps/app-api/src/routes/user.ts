import { Type } from '@sinclair/typebox'
import {
  changePassword,
  registerAccount,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from '@yongstack/account'
import { resolveRequestLocale } from '@yongstack/http'
import { hashIdempotencyRequest, withIdempotency } from '@yongstack/idempotency'
import { getUserAccess, type UserAccess } from '@yongstack/rbac'
import { clearSessionCookie, type SessionStore, setSessionCookie } from '@yongstack/session'
import { isEmailVerificationRequired } from '@yongstack/settings'
import { assertNever, ErrorResponse } from '@yongstack/shared'
import {
  getUserById,
  loginUser,
  updateLastLogin,
  updateProfile,
  updateUserLocale,
} from '@yongstack/user'
import * as UserModel from '@yongstack/user/model'
import { type Cookie, Elysia, status } from 'elysia'

import { type AppPlugins } from '../plugins'

const SessionItemSchema = Type.Object({
  id: Type.String(),
  createdAt: Type.String(),
  lastSeenAt: Type.String(),
  userAgent: Type.Union([Type.String(), Type.Null()]),
  ip: Type.Union([Type.String(), Type.Null()]),
  current: Type.Boolean(),
})

const SessionListResponseSchema = Type.Object({
  items: Type.Array(SessionItemSchema),
})

function sessionCookieFrom(cookie: unknown, name: string): Cookie<unknown> | undefined {
  return (cookie as Record<string, Cookie<unknown> | undefined>)[name]
}

function requestMeta(request: Request): { userAgent: string | null; ip: string | null } {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip')
  return {
    userAgent: request.headers.get('user-agent'),
    ip,
  }
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

export function createUserRoutes(plugins: AppPlugins) {
  const { dbPlugin, sessionPlugin, authRateLimit, isProduction, sessionCookieName } = plugins
  const { authRateLimitPerMinute, defaultLocale } = plugins
  const requestLocale = (request: Request) => resolveRequestLocale(request, defaultLocale)

  return new Elysia({ name: 'user-app', prefix: '/auth' })
    .use(plugins.localePlugin)
    .use(dbPlugin)
    .use(sessionPlugin)
    .use(authRateLimit)
    .post(
      '/register',
      async ({ body, cookie, db, sessionStore, request, i18n }) => {
        const locale = requestLocale(request)
        const result = await registerAccount(body, db, { locale })
        if (result.isErr()) {
          switch (result.error) {
            case 'EMAIL_ALREADY_REGISTERED':
              return status(409, {
                error: result.error,
                message: i18n('Email already registered'),
              })
            default:
              return assertNever(result.error)
          }
        }

        const user = result.value
        const access = await getUserAccess(user.id, db)
        await updateLastLogin(user.id, db)
        user.lastLoginAt = new Date()
        await startSession({
          userId: user.id,
          access,
          cookie,
          request,
          sessionStore,
          sessionCookieName,
          isProduction,
        })
        return status(201, { ...user, ...access })
      },
      {
        body: UserModel.RegisterInputSchema,
        response: { 201: UserModel.AuthUserResponseSchema, 409: ErrorResponse },
        rateLimit: { limit: authRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Auth'],
          summary: '注册',
          description: `注册新用户并自动登录。\n\n- 邮箱已存在返回 409\n- 限流：60 秒内最多 ${authRateLimitPerMinute} 次尝试`,
        },
      },
    )
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
        if ((await isEmailVerificationRequired(db)) && user.emailVerifiedAt === null) {
          return status(403, {
            error: 'EMAIL_NOT_VERIFIED',
            message: i18n('Email not verified'),
          })
        }

        const access = await getUserAccess(user.id, db)
        const locale = requestLocale(request)
        if (locale !== user.locale) {
          await updateUserLocale(user.id, locale, db)
          user.locale = locale
        }
        await updateLastLogin(user.id, db)
        user.lastLoginAt = new Date()

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
          summary: '登录',
          description: `邮箱密码登录，成功后设置签名 session cookie。\n\n- 凭据错误返回 401\n- 账号被禁用/邮箱未验证返回 403\n- 限流：60 秒内最多 ${authRateLimitPerMinute} 次尝试`,
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
        if (!result.value.isActive) {
          return status(403, { error: 'ACCOUNT_DISABLED', message: i18n('Account is disabled') })
        }
        const access = await getUserAccess(session.userId, db)
        return { ...result.value, ...access }
      },
      {
        isAuth: true,
        response: {
          200: UserModel.AuthUserResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
        },
        detail: {
          tags: ['Auth'],
          summary: '当前用户信息',
          description: '获取当前登录用户的信息与 roles/permissions。\n\n- 需要登录',
        },
      },
    )
    .patch(
      '/me',
      async ({ body, session, db, i18n }) => {
        const result = await updateProfile(session.userId, body, db)
        if (result.isErr()) {
          switch (result.error) {
            case 'USER_NOT_FOUND':
              return status(404, { error: result.error, message: i18n('User not found') })
            default:
              return assertNever(result.error)
          }
        }
        const access = await getUserAccess(session.userId, db)
        return { ...result.value, ...access }
      },
      {
        isAuth: true,
        body: UserModel.UpdateProfileInputSchema,
        response: {
          200: UserModel.AuthUserResponseSchema,
          401: ErrorResponse,
          404: ErrorResponse,
        },
        detail: {
          tags: ['Auth'],
          summary: '更新个人资料',
          description: '更新当前登录用户的姓名、手机号、头像。\n\n- 需要登录',
        },
      },
    )
    .get(
      '/sessions',
      async ({ session, sessionStore, cookie }) => {
        const currentId = sessionCookieFrom(cookie, sessionCookieName)?.value
        const sessions = await sessionStore.listForUser(session.userId)
        return {
          items: sessions.map((item) => ({
            id: item.id,
            createdAt: item.createdAt,
            lastSeenAt: item.lastSeenAt,
            userAgent: item.userAgent,
            ip: item.ip,
            current: item.id === currentId,
          })),
        }
      },
      {
        isAuth: true,
        response: {
          200: SessionListResponseSchema,
          401: ErrorResponse,
        },
        detail: {
          tags: ['Auth/Sessions'],
          summary: '活跃会话列表',
          description: '列出当前用户的全部会话及元数据。\n\n- 需要登录',
        },
      },
    )
    .delete(
      '/sessions/:id',
      async ({ params, session, sessionStore, cookie }) => {
        const currentId = sessionCookieFrom(cookie, sessionCookieName)?.value
        const target = await sessionStore.read(params.id)
        if (target && target.userId === session.userId) {
          await sessionStore.destroy(params.id)
          if (params.id === currentId) {
            clearSessionCookie(sessionCookieFrom(cookie, sessionCookieName), isProduction)
          }
        }
        return status(204)
      },
      {
        isAuth: true,
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        detail: {
          tags: ['Auth/Sessions'],
          summary: '撤销指定会话',
          description: '只能撤销属于当前用户的会话。\n\n- 需要登录',
        },
      },
    )
    .delete(
      '/sessions',
      async ({ session, sessionStore, cookie }) => {
        const currentId = sessionCookieFrom(cookie, sessionCookieName)?.value
        if (typeof currentId === 'string' && currentId.length > 0) {
          await sessionStore.destroyOtherSessions(session.userId, currentId)
        }
        return status(204)
      },
      {
        isAuth: true,
        detail: {
          tags: ['Auth/Sessions'],
          summary: '撤销其他会话',
          description: '保留当前会话，撤销该用户其他所有会话。\n\n- 需要登录',
        },
      },
    )
    .post(
      '/change-password',
      async ({ body, session, sessionStore, cookie, db, i18n }) => {
        const result = await changePassword(session.userId, body, db)
        if (result.isErr()) {
          switch (result.error) {
            case 'LOGIN_FAILED':
              return status(401, {
                error: 'CURRENT_PASSWORD_INVALID',
                message: i18n('Current password is incorrect'),
              })
            default:
              return assertNever(result.error)
          }
        }
        const currentId = sessionCookieFrom(cookie, sessionCookieName)?.value
        if (typeof currentId === 'string' && currentId.length > 0) {
          await sessionStore.destroyOtherSessions(session.userId, currentId)
        }
        return status(204)
      },
      {
        isAuth: true,
        body: UserModel.ChangePasswordInputSchema,
        rateLimit: { limit: 10, window: '60s' },
        detail: {
          tags: ['Auth'],
          summary: '修改密码',
          description: '校验当前密码后更新密码，并撤销其他设备会话。\n\n- 需要登录',
        },
      },
    )
    .post(
      '/forgot-password',
      async ({ body, db, request, headers, i18n }) => {
        const locale = requestLocale(request)
        const idempotencyKey = headers['idempotency-key']
        if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
          await requestPasswordReset(body.email, db, { locale })
          return status(202)
        }

        const result = await withIdempotency(
          {
            scope: 'auth.forgot-password',
            key: idempotencyKey,
            requestHash: hashIdempotencyRequest({ email: body.email }),
          },
          db,
          async () => {
            await requestPasswordReset(body.email, db, { locale })
            return { statusCode: 202, body: {} }
          },
        )
        if (result.isErr()) {
          return status(409, {
            error: result.error,
            message: i18n('Idempotency key reused with a different request'),
          })
        }
        return status(202)
      },
      {
        body: UserModel.ForgotPasswordInputSchema,
        rateLimit: { limit: 5, window: '60s' },
        detail: {
          tags: ['Auth'],
          summary: '忘记密码',
          description: '发送密码重置邮件。邮箱不存在也返回 202，不泄露注册状态。',
        },
      },
    )
    .post(
      '/reset-password',
      async ({ body, db, sessionStore, i18n }) => {
        const result = await resetPassword(body, db)
        if (result.isErr()) {
          switch (result.error) {
            case 'TOKEN_INVALID':
              return status(400, { error: result.error, message: i18n('Invalid token') })
            case 'TOKEN_EXPIRED':
              return status(400, { error: result.error, message: i18n('Token expired') })
            default:
              return assertNever(result.error)
          }
        }
        await sessionStore.destroyAllForUser(result.value.userId)
        return status(204)
      },
      {
        body: UserModel.ResetPasswordInputSchema,
        rateLimit: { limit: 10, window: '60s' },
        response: { 400: ErrorResponse },
        detail: {
          tags: ['Auth'],
          summary: '重置密码',
          description: '用邮件中的令牌设置新密码，成功后撤销全部会话。',
        },
      },
    )
    .post(
      '/verify-email',
      async ({ body, db, i18n }) => {
        const result = await verifyEmail(body, db)
        if (result.isErr()) {
          switch (result.error) {
            case 'TOKEN_INVALID':
              return status(400, { error: result.error, message: i18n('Invalid token') })
            case 'TOKEN_EXPIRED':
              return status(400, { error: result.error, message: i18n('Token expired') })
            default:
              return assertNever(result.error)
          }
        }
        return status(204)
      },
      {
        body: UserModel.VerifyEmailInputSchema,
        rateLimit: { limit: 10, window: '60s' },
        response: { 400: ErrorResponse },
        detail: {
          tags: ['Auth'],
          summary: '验证邮箱',
          description: '用邮件中的令牌验证邮箱。',
        },
      },
    )
    .post(
      '/resend-verification',
      async ({ session, db, request, i18n }) => {
        const result = await requestEmailVerification(session.userId, db, {
          locale: requestLocale(request),
        })
        if (result.isErr()) {
          switch (result.error) {
            case 'USER_NOT_FOUND':
              return status(404, { error: result.error, message: i18n('User not found') })
            default:
              return assertNever(result.error)
          }
        }
        return status(202)
      },
      {
        isAuth: true,
        rateLimit: { limit: 5, window: '60s' },
        detail: {
          tags: ['Auth'],
          summary: '重发验证邮件',
          description: '为当前未验证用户重发验证邮件。',
        },
      },
    )
}
