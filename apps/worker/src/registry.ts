import { closeDb, createDb, type Db } from '@yongstack/database'
import { createMailer } from '@yongstack/mailer'
import { EMAIL_QUEUE_NAME, type SendEmailJobData } from '@yongstack/notifications'
import { getOutboxStats, type OutboxStats } from '@yongstack/outbox'
import { createQueue, type Queue, type Worker } from '@yongstack/queue'
import type { Logger } from '@yongstack/shared'
import { createStorage, type StorageEnv } from '@yongstack/storage'

import { registerEmailWorker } from './emailWorker'
import type { WorkerEnv } from './env'
import { registerFileCleanupWorker } from './fileCleanupWorker'
import { MAINTENANCE_QUEUE_NAME } from './maintenance/jobs'
import { registerMaintenanceSchedulers } from './maintenance/scheduler'
import { registerMaintenanceWorker } from './maintenance/worker'
import { registerOutboxWorker } from './outboxWorker'
import type { PeriodicTaskHandle } from './periodic'

export interface WorkerRegistration {
  workers: Worker[]
  // 队列名 → 实例: /metrics 端点采集 BullMQ job counts
  queues: { name: string; queue: Queue }[]
  // readiness: DB + Redis 可用性; 不阻塞 /health/live
  ready: () => Promise<{ db: boolean; redis: boolean }>
  // /metrics 采集 outbox 状态与最久 pending 年龄
  outboxStats: () => Promise<OutboxStats>
  close: () => Promise<void>
}

export async function registerWorkers(env: WorkerEnv, logger: Logger): Promise<WorkerRegistration> {
  const mailer = createMailer(
    {
      transport: env.MAIL_TRANSPORT,
      from: env.MAIL_FROM ?? 'Yongstack <no-reply@yongstack.local>',
      smtp:
        env.MAIL_TRANSPORT === 'smtp'
          ? {
              host: env.SMTP_HOST ?? '',
              port: Number(env.SMTP_PORT ?? '0'),
              ...(env.SMTP_USER === undefined ? {} : { user: env.SMTP_USER }),
              ...(env.SMTP_PASS === undefined ? {} : { pass: env.SMTP_PASS }),
            }
          : undefined,
    },
    logger,
  )

  const emailQueue = createQueue<SendEmailJobData>(EMAIL_QUEUE_NAME, { redisUrl: env.REDIS_URL })
  const emailWorker = registerEmailWorker(env.REDIS_URL, mailer, logger)
  const maintenanceQueue = createQueue(MAINTENANCE_QUEUE_NAME, { redisUrl: env.REDIS_URL })

  // 共享同一个连接池: outbox 与 file cleanup 复用, 由本组装根统一关闭
  const sharedDb: Db = createDb(env.DATABASE_URL)
  const outboxWorker = registerOutboxWorker(env, emailQueue, sharedDb, logger)
  const maintenanceWorker = registerMaintenanceWorker(env, sharedDb, logger)
  await registerMaintenanceSchedulers(maintenanceQueue)

  // 软删文件存储补偿; 未配置对象存储时跳过文件清理任务
  let fileCleanupWorker: PeriodicTaskHandle | null = null
  if (env.STORAGE_BUCKET !== undefined && env.STORAGE_PUBLIC_BASE_URL !== undefined) {
    const storage = createStorage(env as unknown as StorageEnv)
    fileCleanupWorker = registerFileCleanupWorker(env, sharedDb, storage, logger)
  }

  logger.info({ env: env.NODE_ENV }, 'worker registry initialized')

  return {
    workers: [emailWorker, maintenanceWorker],
    queues: [
      { name: EMAIL_QUEUE_NAME, queue: emailQueue },
      { name: MAINTENANCE_QUEUE_NAME, queue: maintenanceQueue },
    ],
    ready: async () => {
      let db = false
      let redis = false
      try {
        await sharedDb.$client`SELECT 1`
        db = true
      } catch {}
      try {
        // 队列计数走 Redis, 顺带验证 broker 可用性
        await emailQueue.getJobCounts('waiting')
        redis = true
      } catch {}
      return { db, redis }
    },
    outboxStats: () => getOutboxStats(sharedDb),
    close: async () => {
      // 先停 BullMQ worker 与队列, 再停轮询任务(等在途一轮), 最后关 DB
      await emailWorker.close()
      await emailQueue.close()
      await maintenanceWorker.close()
      await maintenanceQueue.close()
      await outboxWorker.close()
      if (fileCleanupWorker) await fileCleanupWorker.close()
      await closeDb(sharedDb)
    },
  }
}
