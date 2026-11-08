import { dbPlugin, localePlugin, redisPlugin } from '@yongstack/http'
import { ADMIN_ROLE_CODE } from '@yongstack/rbac'
import { authRateLimit, createSessionPlugin } from '@yongstack/session'
import { type Logger } from '@yongstack/shared'
import { type SmsProvider } from '@yongstack/sms'

import { type AdminAppOptions } from './deps'

export interface AdminPlugins {
  dbPlugin: ReturnType<typeof dbPlugin>
  redisPlugin: ReturnType<typeof redisPlugin>
  localePlugin: ReturnType<typeof localePlugin>
  sessionPlugin: ReturnType<typeof createSessionPlugin>
  authRateLimit: ReturnType<typeof authRateLimit>
  sessionCookieName: string
  storage: AdminAppOptions['storage']
  sms: SmsProvider
  phoneCodeSecret: string
  smsDevCode?: string
  isProduction: boolean
  logger: Logger
  authRateLimitPerMinute: number
  // 审计/会话取 IP 时是否信任 x-forwarded-for 等转发头(来自 env TRUST_PROXY)
  trustProxy: boolean
}

export function createPlugins(options: Omit<AdminAppOptions, 'corsOrigin'>): AdminPlugins {
  const {
    db,
    redis,
    storage,
    sms,
    sessionCookieName,
    sessionSecret,
    phoneCodeSecret,
    smsDevCode,
    trustProxy,
    isProduction,
    logger,
  } = options
  return {
    dbPlugin: dbPlugin(db),
    redisPlugin: redisPlugin(redis, { logger }),
    localePlugin: localePlugin({ defaultLocale: options.defaultLocale }),
    sessionPlugin: createSessionPlugin({
      redis,
      sessionSecret,
      cookieName: sessionCookieName,
      isProduction,
      logger,
      defaultLocale: options.defaultLocale,
      adminRoleCode: ADMIN_ROLE_CODE,
    }),
    authRateLimit: authRateLimit({
      redis,
      prefix: 'rl:admin',
      trustProxy,
      defaultLocale: options.defaultLocale,
    }),
    sessionCookieName,
    storage,
    sms,
    phoneCodeSecret,
    ...(smsDevCode === undefined ? {} : { smsDevCode }),
    isProduction,
    logger,
    authRateLimitPerMinute: options.authRateLimitPerMinute,
    trustProxy,
  }
}
