import { bindPhone, requestPhoneBindCode, unbindPhone } from '@yongstack/account'
import { loginWithPhone } from '@yongstack/auth'
import { resolveRequestLocale } from '@yongstack/http'
import { type Translator } from '@yongstack/i18n'
import { startSession } from '@yongstack/session'
import { assertNever, ErrorResponse, RateLimitErrorResponse } from '@yongstack/shared'
import { CodeRequestedTooSoonError, requestPhoneLoginCode } from '@yongstack/user'
import * as UserModel from '@yongstack/user/model'
import { Elysia, status } from 'elysia'

import { type AppPlugins } from '../plugins'

export function createPhoneRoutes(plugins: AppPlugins) {
  const { dbPlugin, sessionPlugin, authRateLimit, isProduction, sessionCookieName, trustProxy } =
    plugins
  const { sms, phoneCodeSecret, smsDevCode, defaultLocale } = plugins
  const requestLocale = (request: Request) => resolveRequestLocale(request, defaultLocale)
  const fixedCode = smsDevCode === undefined ? undefined : smsDevCode

  async function sendCode(to: string, code: string, i18n: Translator) {
    const text = i18n('Your Yongstack login code is {code}. It expires in {minutes} minutes.', {
      code,
      minutes: '5',
    })
    return sms.send({ to, text })
  }

  return new Elysia({ name: 'phone-auth-app', prefix: '/auth/phone' })
    .use(plugins.localePlugin)
    .use(dbPlugin)
    .use(sessionPlugin)
    .use(authRateLimit)
    .post(
      '/request-code',
      async ({ body, db, i18n, set }) => {
        const result = await requestPhoneLoginCode(
          body.phone,
          phoneCodeSecret,
          db,
          fixedCode === undefined ? {} : { fixedCode },
        )
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

        const sent = await sendCode(body.phone, result.value.code, i18n)
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
          summary: '请求手机号登录验证码',
          description:
            '向手机号发送 6 位验证码。未注册手机号会在验证成功后自动建号。\n\n- 冷却中返回 429，响应体含 retryAfterSeconds，响应头含 Retry-After',
        },
      },
    )
    .post(
      '/login',
      async ({ body, cookie, db, sessionStore, request, i18n }) => {
        const result = await loginWithPhone(body.phone, body.code, {
          client: db,
          secret: phoneCodeSecret,
          locale: requestLocale(request),
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
            case 'ACCOUNT_DISABLED':
              return status(403, {
                error: result.error,
                message: i18n('Account is disabled'),
              })
            case 'PHONE_ALREADY_IN_USE':
              return status(409, {
                error: result.error,
                message: i18n('Phone number already in use'),
              })
            case 'USER_NOT_FOUND':
              return status(404, { error: result.error, message: i18n('User not found') })
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
          403: ErrorResponse,
          404: ErrorResponse,
          409: ErrorResponse,
          429: ErrorResponse,
        },
        detail: {
          tags: ['Auth/Phone'],
          summary: '手机号验证码登录',
          description: '校验验证码并登录；手机号首次登录会自动创建 member 账号。',
        },
      },
    )
    .post(
      '/bind/request-code',
      async ({ body, session, db, i18n, set }) => {
        const result = await requestPhoneBindCode(session.userId, body.phone, db, {
          secret: phoneCodeSecret,
          ...(fixedCode === undefined ? {} : { fixedCode }),
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
            case 'PHONE_ALREADY_IN_USE':
              return status(409, {
                error: result.error,
                message: i18n('Phone number already in use'),
              })
            case 'CODE_RATE_LIMITED':
              return status(429, { error: result.error, message: i18n('Too many requests') })
            default:
              return assertNever(result.error)
          }
        }

        const sent = await sendCode(body.phone, result.value.code, i18n)
        if (sent.isErr()) {
          return status(502, {
            error: sent.error,
            message: i18n('Failed to send verification code'),
          })
        }
        return status(202)
      },
      {
        isAuth: true,
        body: UserModel.PhoneBindRequestSchema,
        rateLimit: { limit: 5, window: '60s' },
        response: { 409: ErrorResponse, 429: RateLimitErrorResponse, 502: ErrorResponse },
        detail: {
          tags: ['Auth/Phone'],
          summary: '请求绑定手机号验证码',
          description:
            '为当前登录用户绑定新手机号，手机号已被占用时返回 409。\n\n- 冷却中返回 429，响应体含 retryAfterSeconds，响应头含 Retry-After',
        },
      },
    )
    .post(
      '/bind',
      async ({ body, session, db, i18n }) => {
        const result = await bindPhone(session.userId, body.phone, body.code, db, {
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
            case 'PHONE_ALREADY_IN_USE':
              return status(409, {
                error: result.error,
                message: i18n('Phone number already in use'),
              })
            case 'USER_NOT_FOUND':
              return status(404, { error: result.error, message: i18n('User not found') })
            case 'CANNOT_UNBIND_ONLY_LOGIN':
              return status(409, {
                error: result.error,
                message: i18n('Cannot unbind the only login method'),
              })
            default:
              return assertNever(result.error)
          }
        }
        return status(204)
      },
      {
        isAuth: true,
        body: UserModel.PhoneBindVerifySchema,
        response: {
          400: ErrorResponse,
          404: ErrorResponse,
          409: ErrorResponse,
          429: ErrorResponse,
        },
        detail: {
          tags: ['Auth/Phone'],
          summary: '绑定手机号',
          description: '校验验证码后把手机号绑定到当前用户。',
        },
      },
    )
    .delete(
      '/',
      async ({ session, db, i18n }) => {
        const result = await unbindPhone(session.userId, db)
        if (result.isErr()) {
          switch (result.error) {
            case 'USER_NOT_FOUND':
              return status(404, { error: result.error, message: i18n('User not found') })
            case 'CANNOT_UNBIND_ONLY_LOGIN':
              return status(409, {
                error: result.error,
                message: i18n('Cannot unbind the only login method'),
              })
            case 'PHONE_ALREADY_IN_USE':
              return status(409, {
                error: result.error,
                message: i18n('Phone number already in use'),
              })
            default:
              return assertNever(result.error)
          }
        }
        return status(204)
      },
      {
        isAuth: true,
        detail: {
          tags: ['Auth/Phone'],
          summary: '解绑手机号',
          description: '解除当前用户手机号绑定；若手机号是唯一登录方式则拒绝。',
        },
      },
    )
}
