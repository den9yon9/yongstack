import { createMailer } from '@yongstack/mailer'
import { EMAIL_QUEUE_NAME, type SendEmailJobData } from '@yongstack/notifications'
import { createQueue, type Queue, type Worker } from '@yongstack/queue'
import type { Logger } from '@yongstack/shared'

import { registerEmailWorker } from './emailWorker'
import type { WorkerEnv } from './env'
import { registerOutboxWorker } from './outboxWorker'

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
  const outboxWorker = registerOutboxWorker(env, emailQueue, logger)

  logger.info({ env: env.NODE_ENV }, 'worker registry initialized')

  return {
    workers: [emailWorker],
    queues: [{ name: EMAIL_QUEUE_NAME, queue: emailQueue }],
    close: async () => {
      await emailWorker.close()
      await emailQueue.close()
      await outboxWorker.close()
    },
  }
}
