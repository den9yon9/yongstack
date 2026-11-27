import { dbPlugin, localePlugin, redisPlugin } from '@yongstack/http'
import { EMAIL_QUEUE_NAME, type SendEmailJobData } from '@yongstack/notifications'
import { createQueue, MAINTENANCE_QUEUE_NAME, type Queue } from '@yongstack/queue'
import { ADMIN_ACCESS_PERMISSION } from '@yongstack/rbac'
import type { Redis } from '@yongstack/redis'
import { apiRateLimit, authRateLimit, createSessionPlugin } from '@yongstack/session'
import { type Logger } from '@yongstack/shared'
import { type SmsProvider } from '@yongstack/sms'

import { type AdminAppOptions } from './deps'

export interface AdminPlugins {
  dbPlugin: ReturnType<typeof dbPlugin>
  redisPlugin: ReturnType<typeof redisPlugin>
  localePlugin: ReturnType<typeof localePlugin>
  sessionPlugin: ReturnType<typeof createSessionPlugin>
  authRateLimit: ReturnType<typeof authRateLimit>
  apiRateLimit: ReturnType<typeof apiRateLimit>
  // session / 限流连接(与队列实例隔离)
  sessionRedis: Redis
  // 队列运维: 专用 queue 连接只读 job counts(无阻塞命令)
  queueRedis: Redis
  emailQueue: Queue<SendEmailJobData>
  queues: Record<string, Queue>
  sessionCookieName: string
  storage: AdminAppOptions['storage']
  sms: SmsProvider
  phoneCodeSecret: string
  smsDevCode?: string
  isProduction: boolean
  logger: Logger
  authRateLimitPerMinute: number
  apiRateLimitPerMinute: number
  // 审计/会话取 IP 时是否信任 x-forwarded-for 等转发头(来自 env TRUST_PROXY)
  trustProxy: boolean
}

export function createPlugins(options: Omit<AdminAppOptions, 'corsOrigin'>): AdminPlugins {
  const {
    db,
    sessionRedis,
    queueRedis,
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
    redisPlugin: redisPlugin(sessionRedis, { logger }),
    localePlugin: localePlugin({ defaultLocale: options.defaultLocale }),
    sessionPlugin: createSessionPlugin({
      redis: sessionRedis,
      sessionSecret,
      cookieName: sessionCookieName,
      isProduction,
      logger,
      defaultLocale: options.defaultLocale,
      adminAccessPermission: ADMIN_ACCESS_PERMISSION,
    }),
    authRateLimit: authRateLimit({
      redis: sessionRedis,
      prefix: 'rl:admin',
      trustProxy,
      defaultLocale: options.defaultLocale,
    }),
    apiRateLimit: apiRateLimit({
      redis: sessionRedis,
      prefix: 'rl:admin:api',
      trustProxy,
      defaultLocale: options.defaultLocale,
    }),
    emailQueue: createQueue<SendEmailJobData>(EMAIL_QUEUE_NAME, { connection: queueRedis }),
    queues: {
      [EMAIL_QUEUE_NAME]: createQueue<SendEmailJobData>(EMAIL_QUEUE_NAME, {
        connection: queueRedis,
      }),
      [MAINTENANCE_QUEUE_NAME]: createQueue(MAINTENANCE_QUEUE_NAME, { connection: queueRedis }),
    },
    sessionRedis,
    queueRedis,
    sessionCookieName,
    storage,
    sms,
    phoneCodeSecret,
    ...(smsDevCode === undefined ? {} : { smsDevCode }),
    isProduction,
    logger,
    authRateLimitPerMinute: options.authRateLimitPerMinute,
    apiRateLimitPerMinute: options.apiRateLimitPerMinute,
    trustProxy,
  }
}
