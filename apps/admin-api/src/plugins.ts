import { dbPlugin, localePlugin, redisPlugin } from '@yongstack/http'
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
  }
}
