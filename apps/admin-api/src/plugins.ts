import { dbPlugin, localePlugin, redisPlugin } from '@yongstack/http'
import { EMAIL_QUEUE_NAME, type SendEmailJobData } from '@yongstack/notifications'
import { createQueue, MAINTENANCE_QUEUE_NAME, type Queue } from '@yongstack/queue'
import { ADMIN_ACCESS_PERMISSION } from '@yongstack/rbac'
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
  // 队列运维: 共享 redis 连接只读 job counts(无阻塞命令, 进程退出随 redis 关闭)
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
      adminAccessPermission: ADMIN_ACCESS_PERMISSION,
    }),
    authRateLimit: authRateLimit({
      redis,
      prefix: 'rl:admin',
      trustProxy,
      defaultLocale: options.defaultLocale,
    }),
    apiRateLimit: apiRateLimit({
      redis,
      prefix: 'rl:admin:api',
      trustProxy,
      defaultLocale: options.defaultLocale,
    }),
    emailQueue: createQueue<SendEmailJobData>(EMAIL_QUEUE_NAME, { connection: redis }),
    queues: {
      [EMAIL_QUEUE_NAME]: createQueue<SendEmailJobData>(EMAIL_QUEUE_NAME, { connection: redis }),
      [MAINTENANCE_QUEUE_NAME]: createQueue(MAINTENANCE_QUEUE_NAME, { connection: redis }),
    },
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
