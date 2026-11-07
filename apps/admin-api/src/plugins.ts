import { dbPlugin, localePlugin, redisPlugin } from '@nestup/http'
import { authRateLimit, createSessionPlugin } from '@nestup/session'
import { type Logger } from '@nestup/shared'

import { type AdminAppOptions } from './deps'

export interface AdminPlugins {
  dbPlugin: ReturnType<typeof dbPlugin>
  redisPlugin: ReturnType<typeof redisPlugin>
  localePlugin: ReturnType<typeof localePlugin>
  sessionPlugin: ReturnType<typeof createSessionPlugin>
  authRateLimit: ReturnType<typeof authRateLimit>
  sessionCookieName: string
  storage: AdminAppOptions['storage']
  isProduction: boolean
  logger: Logger
  authRateLimitPerMinute: number
}

export function createPlugins(options: Omit<AdminAppOptions, 'corsOrigin'>): AdminPlugins {
  const { db, redis, sessionCookieName, sessionSecret, trustProxy, isProduction, logger, storage } =
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
      prefix: 'rl:admin',
      trustProxy,
      defaultLocale: options.defaultLocale,
    }),
    sessionCookieName,
    storage,
    isProduction,
    logger,
    authRateLimitPerMinute: options.authRateLimitPerMinute,
  }
}
