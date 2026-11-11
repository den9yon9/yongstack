import { createDb, type Db } from '@yongstack/database'
import { type Locale } from '@yongstack/i18n'
import { createRedisClient, type Redis } from '@yongstack/redis'
import { createLogger, type Logger } from '@yongstack/shared'
import { createSmsProvider, type SmsProvider } from '@yongstack/sms'
import { createStorage, type Storage } from '@yongstack/storage'

import { type AdminEnv } from './env'

export const ADMIN_SESSION_COOKIE = 'yongstack_admin_session'

export interface AdminAppOptions {
  db: Db
  redis: Redis
  storage: Storage
  sms: SmsProvider
  sessionCookieName: string
  sessionSecret: string
  phoneCodeSecret: string
  smsDevCode?: string
  corsOrigin: true | string | string[]
  trustProxy: boolean
  isProduction: boolean
  logger: Logger
  sentryDsn?: string
  sentryEnvironment?: string
  sentryRelease?: string
  authRateLimitPerMinute: number
  apiRateLimitPerMinute: number
  defaultLocale: Locale
}

export function createAdminDeps(env: AdminEnv): AdminAppOptions {
  const logger = createLogger(env.LOG_LEVEL)
  return {
    db: createDb(env.DATABASE_URL),
    redis: createRedisClient(env.REDIS_URL),
    storage: createStorage(env),
    sms: createSmsProvider({ provider: env.SMS_PROVIDER, signName: env.SMS_SIGN_NAME }, logger),
    sessionCookieName: ADMIN_SESSION_COOKIE,
    sessionSecret: env.SESSION_SECRET,
    phoneCodeSecret: env.PHONE_CODE_SECRET ?? env.SESSION_SECRET,
    ...(env.SMS_DEV_CODE === undefined ? {} : { smsDevCode: env.SMS_DEV_CODE }),
    corsOrigin: env.CORS_ORIGIN,
    trustProxy: env.TRUST_PROXY,
    isProduction: env.NODE_ENV === 'production',
    logger,
    ...(env.SENTRY_DSN === undefined ? {} : { sentryDsn: env.SENTRY_DSN }),
    ...(env.SENTRY_ENVIRONMENT === undefined ? {} : { sentryEnvironment: env.SENTRY_ENVIRONMENT }),
    ...(env.SENTRY_RELEASE === undefined ? {} : { sentryRelease: env.SENTRY_RELEASE }),
    authRateLimitPerMinute: Number(env.AUTH_RATE_LIMIT_PER_MINUTE),
    apiRateLimitPerMinute: Number(env.API_RATE_LIMIT_PER_MINUTE),
    defaultLocale: env.DEFAULT_LOCALE,
  }
}
