import { closeDb, createDb, type Db } from '@yongstack/database'
import { createMailer } from '@yongstack/mailer'
import { EMAIL_QUEUE_NAME, type SendEmailJobData } from '@yongstack/notifications'
import { createQueue, type Queue, type Worker } from '@yongstack/queue'
import type { Logger } from '@yongstack/shared'
import { createStorage, type StorageEnv } from '@yongstack/storage'

import { registerEmailWorker } from './emailWorker'
import type { WorkerEnv } from './env'
import { registerFileCleanupWorker } from './fileCleanupWorker'
import { registerOutboxWorker } from './outboxWorker'
import type { PeriodicTaskHandle } from './periodic'

export interface WorkerRegistration {
  workers: Worker[]
  // 队列名 → 实例: /metrics 端点采集 BullMQ job counts
  queues: { name: string; queue: Queue }[]
  close: () => Promise<void>
}

export function registerWorkers(env: WorkerEnv, logger: Logger): WorkerRegistration {
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

  // 共享同一个连接池: outbox 与 file cleanup 复用, 由本组装根统一关闭
  const sharedDb: Db = createDb(env.DATABASE_URL)
  const outboxWorker = registerOutboxWorker(env, emailQueue, sharedDb, logger)

  // 软删文件存储补偿; 未配置对象存储时跳过文件清理任务
  let fileCleanupWorker: PeriodicTaskHandle | null = null
  if (env.STORAGE_BUCKET !== undefined && env.STORAGE_PUBLIC_BASE_URL !== undefined) {
    const storage = createStorage(env as unknown as StorageEnv)
    fileCleanupWorker = registerFileCleanupWorker(env, sharedDb, storage, logger)
  }

  logger.info({ env: env.NODE_ENV }, 'worker registry initialized')

  return {
    workers: [emailWorker],
    queues: [{ name: EMAIL_QUEUE_NAME, queue: emailQueue }],
    close: async () => {
      // 先停 BullMQ worker 与队列, 再停轮询任务(等在途一轮), 最后关 DB
      await emailWorker.close()
      await emailQueue.close()
      await outboxWorker.close()
      if (fileCleanupWorker) await fileCleanupWorker.close()
      await closeDb(sharedDb)
    },
  }
}
