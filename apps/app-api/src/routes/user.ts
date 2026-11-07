import { registerAccount } from '@yongstack/account'
import { resolveRequestLocale } from '@yongstack/http'
import { clearSessionCookie, setSessionCookie } from '@yongstack/session'
import { assertNever, ErrorResponse } from '@yongstack/shared'
import { getUserById, loginUser, updateProfile, updateUserLocale } from '@yongstack/user'
import * as UserModel from '@yongstack/user/model'
import { Elysia, status } from 'elysia'

import { type AppPlugins } from '../plugins'

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
        const sessionCookie = cookie[sessionCookieName]
        const oldSid = sessionCookie?.value
        if (typeof oldSid === 'string' && oldSid.length > 0) {
          await sessionStore.destroy(oldSid)
        }
        const sessionId = await sessionStore.create({ userId: user.id, role: user.role })
        setSessionCookie(sessionCookie, sessionId, isProduction)
        return status(201, user)
      },
      {
        body: UserModel.RegisterInputSchema,
        response: { 201: UserModel.UserResponseSchema, 409: ErrorResponse },
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
        const sessionCookie = cookie[sessionCookieName]
        const oldSid = sessionCookie?.value
        if (typeof oldSid === 'string' && oldSid.length > 0) {
          await sessionStore.destroy(oldSid)
        }

        // 登录刷新语言偏好(邮件等异步通知据此渲染)
        const locale = requestLocale(request)
        if (locale !== user.locale) {
          await updateUserLocale(user.id, locale, db)
          user.locale = locale
        }

        const sessionId = await sessionStore.create({ userId: user.id, role: user.role })
        setSessionCookie(sessionCookie, sessionId, isProduction)
        return user
      },
      {
        body: UserModel.LoginInputSchema,
        rateLimit: { limit: authRateLimitPerMinute, window: '60s' },
        response: { 200: UserModel.UserResponseSchema, 401: ErrorResponse, 403: ErrorResponse },
        detail: {
          tags: ['Auth'],
          summary: '登录',
          description: `邮箱密码登录，成功后设置签名 session cookie。\n\n- 凭据错误返回 401\n- 账号被禁用返回 403\n- 限流：60 秒内最多 ${authRateLimitPerMinute} 次尝试`,
        },
      },
    )
    .post(
      '/logout',
      async ({ cookie, session, sessionStore }) => {
        const sessionCookie = cookie[sessionCookieName]
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
        return result.value
      },
      {
        isAuth: true,
        response: {
          200: UserModel.UserResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
        },
        detail: {
          tags: ['Auth'],
          summary: '当前用户信息',
          description: '获取当前登录用户的信息。\n\n- 需要登录\n- 用户不存在返回 404',
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
        return result.value
      },
      {
        isAuth: true,
        body: UserModel.UpdateProfileInputSchema,
        response: { 200: UserModel.UserResponseSchema, 401: ErrorResponse, 404: ErrorResponse },
        detail: {
          tags: ['Auth'],
          summary: '更新个人资料',
          description: '更新当前登录用户的姓名、手机号、头像。\n\n- 需要登录\n- 用户不存在返回 404',
        },
      },
    )
}
