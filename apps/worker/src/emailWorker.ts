import type { Mailer } from '@yongstack/mailer'
import { EMAIL_JOB_NAMES, EMAIL_QUEUE_NAME, type SendEmailJobData } from '@yongstack/notifications'
import { createDispatcher, createWorker, type Worker } from '@yongstack/queue'
import type { Logger } from '@yongstack/shared'

import { renderEmail } from './templates'

export function registerEmailWorker(
  redisUrl: string,
  mailer: Mailer,
  logger: Logger,
): Worker<SendEmailJobData> {
  const processor = createDispatcher<SendEmailJobData>(
    {
      [EMAIL_JOB_NAMES.WELCOME]: async (data, handlerLogger) => {
        const rendered = renderEmail(data.template, data.vars, data.locale)
        const result = await mailer.send({ to: data.to, ...rendered })
        if (result.isErr()) throw new Error(`mail send failed: ${result.error}`)
        handlerLogger.info({ to: data.to, template: data.template }, 'email sent')
      },
    },
    logger,
  )

  return createWorker<SendEmailJobData>(EMAIL_QUEUE_NAME, processor, { redisUrl, logger })
}
