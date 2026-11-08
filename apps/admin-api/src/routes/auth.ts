import {
  loginAdminWithPassword,
  loginAdminWithPhone,
  requestAdminLoginPhoneCode,
} from '@yongstack/auth'
import { ADMIN_ROLE_CODE, getUserAccess } from '@yongstack/rbac'
import { clearSessionCookie, sessionCookieFrom, startSession } from '@yongstack/session'
import { assertNever, ErrorResponse, RateLimitErrorResponse, requestMeta } from '@yongstack/shared'
import { CodeRequestedTooSoonError, getUserById } from '@yongstack/user'
import * as UserModel from '@yongstack/user/model'
import { Elysia, status } from 'elysia'

import { type AdminPlugins } from '../plugins'

export function createAuthRoutes(plugins: AdminPlugins) {
  const { dbPlugin, sessionPlugin, authRateLimit, isProduction, sessionCookieName, trustProxy } =
    plugins
  const { authRateLimitPerMinute, sms, phoneCodeSecret, smsDevCode } = plugins
  const codeOptions = smsDevCode === undefined ? undefined : smsDevCode

  return new Elysia({ name: 'auth-admin', prefix: '/auth' })
    .use(plugins.localePlugin)
    .use(dbPlugin)
    .use(sessionPlugin)
    .use(authRateLimit)
    .post(
      '/login',
      async ({ body, cookie, db, sessionStore, request, i18n }) => {
        // 编排在 usecases/auth: 校验 → admin 角色 → 审计; 控制器只做 cookie/状态映射
        const result = await loginAdminWithPassword(body, {
          client: db,
          actorMeta: requestMeta(request, { trustProxy }),
        })
        if (result.isErr()) {
          switch (result.error) {
            case 'LOGIN_FAILED':
              return status(401, {
                error: result.error,
                message: i18n('Invalid email or password'),
              })
            case 'ACCOUNT_DISABLED':
              return status(403, { error: result.error, message: i18n('Account is disabled') })
            case 'FORBIDDEN':
              return status(403, {
                error: result.error,
                message: i18n('Account is not an administrator'),
              })
            default:
              return assertNever(result.error)
          }
        }

        const { user, access } = result.value
        await startSession({
          userId: user.id,
          roles: access.roles,
          permissions: access.permissions,
          cookie,
          request,
          sessionStore,
          sessionCookieName,
          isProduction,
          trustProxy,
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
      '/phone/request-code',
      async ({ body, db, i18n, set }) => {
        const result = await requestAdminLoginPhoneCode(body.phone, db, {
          secret: phoneCodeSecret,
          ...(codeOptions === undefined ? {} : { fixedCode: codeOptions }),
        })
        if (result.isErr()) {
          if (result.error instanceof CodeRequestedTooSoonError) {
            const { retryAfterSeconds } = result.error
            set.headers['retry-after'] = String(retryAfterSeconds)
            return status(429, {
              error: result.error.code,
              message: i18n('Please wait {seconds} seconds before requesting another code', {
                seconds: String(retryAfterSeconds),
              }),
              retryAfterSeconds,
            })
          }

          switch (result.error) {
            case 'CODE_RATE_LIMITED':
              return status(429, { error: result.error, message: i18n('Too many requests') })
            default:
              return assertNever(result.error)
          }
        }
        // 非管理员/未绑定手机号: 仍返回 202, 不泄露账号状态
        if (result.value === null) return status(202)

        const text = i18n(
          'Your Yongstack admin login code is {code}. It expires in {minutes} minutes.',
          { code: result.value.code, minutes: '5' },
        )
        const sent = await sms.send({ to: body.phone, text })
        if (sent.isErr()) {
          return status(502, {
            error: sent.error,
            message: i18n('Failed to send verification code'),
          })
        }
        return status(202)
      },
      {
        body: UserModel.PhoneLoginRequestSchema,
        rateLimit: { limit: 5, window: '60s' },
        response: { 429: RateLimitErrorResponse, 502: ErrorResponse },
        detail: {
          tags: ['Auth/Phone'],
          summary: '请求管理员手机号登录验证码',
          description:
            '仅已绑定手机号的管理员会收到验证码；其他情况仍返回 202。\n\n- 冷却中返回 429，响应体含 retryAfterSeconds，响应头含 Retry-After',
        },
      },
    )
    .post(
      '/phone/login',
      async ({ body, cookie, db, sessionStore, request, i18n }) => {
        const result = await loginAdminWithPhone(body.phone, body.code, {
          client: db,
          secret: phoneCodeSecret,
        })
        if (result.isErr()) {
          switch (result.error) {
            case 'CODE_INVALID':
              return status(400, {
                error: result.error,
                message: i18n('Invalid verification code'),
              })
            case 'CODE_EXPIRED':
              return status(400, {
                error: result.error,
                message: i18n('Verification code expired'),
              })
            case 'CODE_ATTEMPTS_EXCEEDED':
              return status(429, {
                error: result.error,
                message: i18n('Too many verification attempts'),
              })
            case 'PHONE_NOT_REGISTERED':
              return status(401, {
                error: result.error,
                message: i18n('Invalid phone number or verification code'),
              })
            case 'ACCOUNT_DISABLED':
              return status(403, {
                error: result.error,
                message: i18n('Account is disabled'),
              })
            case 'FORBIDDEN':
              return status(403, {
                error: result.error,
                message: i18n('Account is not an administrator'),
              })
            default:
              return assertNever(result.error)
          }
        }

        const { user, access } = result.value
        await startSession({
          userId: user.id,
          roles: access.roles,
          permissions: access.permissions,
          cookie,
          request,
          sessionStore,
          sessionCookieName,
          isProduction,
          trustProxy,
        })
        return { ...user, ...access }
      },
      {
        body: UserModel.PhoneLoginVerifySchema,
        rateLimit: { limit: 10, window: '60s' },
        response: {
          200: UserModel.AuthUserResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          429: ErrorResponse,
        },
        detail: {
          tags: ['Auth/Phone'],
          summary: '管理员手机号验证码登录',
          description: '仅允许已绑定手机号的 admin 账号登录，不自动注册。',
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
        const access = await getUserAccess(user.id, db)
        if (!access.roles.includes(ADMIN_ROLE_CODE)) {
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
