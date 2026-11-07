import { createDb, type Db } from '@nestup/database'
import { type Locale } from '@nestup/i18n'
import { createRedisClient, type Redis } from '@nestup/redis'
import { createLogger, type Logger } from '@nestup/shared'

import { type StorefrontEnv } from './env'

export const STOREFRONT_SESSION_COOKIE = 'nestup_session'

export interface StorefrontAppOptions {
  db: Db
  redis: Redis
  sessionCookieName: string
  sessionSecret: string
  corsOrigin: true | string | string[]
  trustProxy: boolean
  isProduction: boolean
  logger: Logger
  authRateLimitPerMinute: number
  defaultLocale: Locale
}

export function createStorefrontDeps(env: StorefrontEnv): StorefrontAppOptions {
  return {
    db: createDb(env.DATABASE_URL),
    redis: createRedisClient(env.REDIS_URL),
    sessionCookieName: STOREFRONT_SESSION_COOKIE,
    sessionSecret: env.SESSION_SECRET,
    corsOrigin: env.CORS_ORIGIN,
    trustProxy: env.TRUST_PROXY,
    isProduction: env.NODE_ENV === 'production',
    logger: createLogger(env.LOG_LEVEL),
    authRateLimitPerMinute: Number(env.AUTH_RATE_LIMIT_PER_MINUTE),
    defaultLocale: env.DEFAULT_LOCALE,
  }
}
