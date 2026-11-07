import { dbPlugin, type HttpMetricsBundle, localePlugin, redisPlugin } from '@nestup/http'
import { type Locale } from '@nestup/i18n'
import { authRateLimit, createSessionPlugin } from '@nestup/session'
import { type Logger } from '@nestup/shared'

import { type StorefrontAppOptions } from './deps'

export interface StorefrontMetrics {
  http: HttpMetricsBundle
}

export interface StorefrontPlugins {
  dbPlugin: ReturnType<typeof dbPlugin>
  redisPlugin: ReturnType<typeof redisPlugin>
  localePlugin: ReturnType<typeof localePlugin>
  sessionPlugin: ReturnType<typeof createSessionPlugin>
  authRateLimit: ReturnType<typeof authRateLimit>
  metrics: StorefrontMetrics
  isProduction: boolean
  logger: Logger
  authRateLimitPerMinute: number
  defaultLocale: Locale
}

export function createPlugins(
  options: Omit<StorefrontAppOptions, 'corsOrigin'>,
  metrics: StorefrontMetrics,
): StorefrontPlugins {
  const { db, redis, sessionSecret, trustProxy, isProduction, logger } = options
  return {
    dbPlugin: dbPlugin(db),
    redisPlugin: redisPlugin(redis, { logger }),
    localePlugin: localePlugin({ defaultLocale: options.defaultLocale }),
    sessionPlugin: createSessionPlugin({
      redis,
      sessionSecret,
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
    metrics,
    isProduction,
    logger,
    authRateLimitPerMinute: options.authRateLimitPerMinute,
    defaultLocale: options.defaultLocale,
  }
}
