import { createDb, type Db } from '@yongstack/database'
import { type Locale } from '@yongstack/i18n'
import { createRedisClient, type Redis } from '@yongstack/redis'
import { createLogger, type Logger } from '@yongstack/shared'
import { createStorage, type Storage } from '@yongstack/storage'

import { type AppEnv } from './env'

export const APP_SESSION_COOKIE = 'yongstack_session'

export interface AppOptions {
  db: Db
  redis: Redis
  storage: Storage
  sessionCookieName: string
  sessionSecret: string
  corsOrigin: true | string | string[]
  trustProxy: boolean
  isProduction: boolean
  logger: Logger
  authRateLimitPerMinute: number
  defaultLocale: Locale
}

export function createAppDeps(env: AppEnv): AppOptions {
  return {
    db: createDb(env.DATABASE_URL),
    redis: createRedisClient(env.REDIS_URL),
    storage: createStorage(env),
    sessionCookieName: APP_SESSION_COOKIE,
    sessionSecret: env.SESSION_SECRET,
    corsOrigin: env.CORS_ORIGIN,
    trustProxy: env.TRUST_PROXY,
    isProduction: env.NODE_ENV === 'production',
    logger: createLogger(env.LOG_LEVEL),
    authRateLimitPerMinute: Number(env.AUTH_RATE_LIMIT_PER_MINUTE),
    defaultLocale: env.DEFAULT_LOCALE,
  }
}
