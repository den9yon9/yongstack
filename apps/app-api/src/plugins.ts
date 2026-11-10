import { dbPlugin, type HttpMetricsBundle, localePlugin, redisPlugin } from '@yongstack/http'
import { type Locale } from '@yongstack/i18n'
import { ADMIN_ROLE_CODE } from '@yongstack/rbac'
import { apiRateLimit, authRateLimit, createSessionPlugin } from '@yongstack/session'
import { type Logger } from '@yongstack/shared'
import { type SmsProvider } from '@yongstack/sms'
import { type Storage } from '@yongstack/storage'

import { type AppOptions } from './deps'

export interface AppMetrics {
  http: HttpMetricsBundle
}

export interface AppPlugins {
  dbPlugin: ReturnType<typeof dbPlugin>
  redisPlugin: ReturnType<typeof redisPlugin>
  localePlugin: ReturnType<typeof localePlugin>
  sessionPlugin: ReturnType<typeof createSessionPlugin>
  authRateLimit: ReturnType<typeof authRateLimit>
  apiRateLimit: ReturnType<typeof apiRateLimit>
  sessionCookieName: string
  storage: Storage
  sms: SmsProvider
  phoneCodeSecret: string
  smsDevCode?: string
  metrics: AppMetrics
  isProduction: boolean
  logger: Logger
  authRateLimitPerMinute: number
  apiRateLimitPerMinute: number
  defaultLocale: Locale
  // 审计/会话取 IP 时是否信任 x-forwarded-for 等转发头(来自 env TRUST_PROXY)
  trustProxy: boolean
}

export function createPlugins(
  options: Omit<AppOptions, 'corsOrigin'>,
  metrics: AppMetrics,
): AppPlugins {
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
      prefix: 'rl:auth',
      trustProxy,
      defaultLocale: options.defaultLocale,
    }),
    apiRateLimit: apiRateLimit({
      redis,
      prefix: 'rl:api',
      trustProxy,
      defaultLocale: options.defaultLocale,
    }),
    sessionCookieName,
    storage,
    sms,
    phoneCodeSecret,
    ...(smsDevCode === undefined ? {} : { smsDevCode }),
    metrics,
    isProduction,
    logger,
    authRateLimitPerMinute: options.authRateLimitPerMinute,
    apiRateLimitPerMinute: options.apiRateLimitPerMinute,
    defaultLocale: options.defaultLocale,
    trustProxy,
  }
}
