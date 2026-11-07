import type { OutboxEvent } from '@yongstack/outbox'
import type { Queue } from '@yongstack/queue'
import type { Logger } from '@yongstack/shared'

import { EMAIL_JOB_NAMES, type SendEmailJobData } from './jobs'

export interface NotificationDispatchOptions {
  emailQueue: Queue<SendEmailJobData>
  appUrl: string
  logger: Logger
}

// 事件 → 通知渠道的映射层。模板渲染与发送在 worker(呈现层)完成。
export async function dispatchOutboxEvent(
  event: OutboxEvent,
  options: NotificationDispatchOptions,
): Promise<void> {
  switch (event.type) {
    case 'user.registered': {
      const payload = event.payload
      const email = typeof payload.email === 'string' ? payload.email : null
      const name = typeof payload.name === 'string' ? payload.name : null
      const userId = typeof payload.userId === 'string' ? payload.userId : null
      const locale = typeof payload.locale === 'string' ? payload.locale : 'en'

      if (!email || !name || !userId) {
        options.logger.warn(
          { eventId: event.id, type: event.type },
          'invalid user.registered payload',
        )
        return
      }

      await options.emailQueue.add(
        EMAIL_JOB_NAMES.WELCOME,
        {
          to: email,
          template: 'welcome',
          locale,
          vars: { name, appUrl: options.appUrl },
        },
        { jobId: `welcome-${userId}` },
      )
      return
    }
    default:
      options.logger.warn({ eventId: event.id, type: event.type }, 'unhandled outbox event')
  }
}
