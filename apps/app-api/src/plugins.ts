import { dbPlugin, type HttpMetricsBundle, localePlugin, redisPlugin } from '@yongstack/http'
import { type Locale } from '@yongstack/i18n'
import { authRateLimit, createSessionPlugin } from '@yongstack/session'
import { type Logger } from '@yongstack/shared'
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
  sessionCookieName: string
  storage: Storage
  metrics: AppMetrics
  isProduction: boolean
  logger: Logger
  authRateLimitPerMinute: number
  defaultLocale: Locale
}

export function createPlugins(
  options: Omit<AppOptions, 'corsOrigin'>,
  metrics: AppMetrics,
): AppPlugins {
  const { db, redis, storage, sessionCookieName, sessionSecret, trustProxy, isProduction, logger } =
    options
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
      prefix: 'rl:auth',
      trustProxy,
      defaultLocale: options.defaultLocale,
    }),
    sessionCookieName,
    storage,
    metrics,
    isProduction,
    logger,
    authRateLimitPerMinute: options.authRateLimitPerMinute,
    defaultLocale: options.defaultLocale,
  }
}
