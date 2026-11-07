import type { OutboxEvent } from '@yongstack/outbox'
import type { Queue } from '@yongstack/queue'
import type { Logger } from '@yongstack/shared'

import { EMAIL_JOB_NAMES, type SendEmailJobData } from './jobs'

export interface NotificationDispatchOptions {
  emailQueue: Queue<SendEmailJobData>
  appUrl: string
  logger: Logger
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

// 事件 → 通知渠道的映射层。模板渲染与发送在 worker(呈现层)完成。
export async function dispatchOutboxEvent(
  event: OutboxEvent,
  options: NotificationDispatchOptions,
): Promise<void> {
  const payload = event.payload

  switch (event.type) {
    case 'user.registered': {
      const email = stringValue(payload.email)
      const name = stringValue(payload.name)
      const userId = stringValue(payload.userId)
      const locale = stringValue(payload.locale) ?? 'en'

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
    case 'user.email_verification_requested': {
      const email = stringValue(payload.email)
      const token = stringValue(payload.token)
      const userId = stringValue(payload.userId)
      const locale = stringValue(payload.locale) ?? 'en'
      const name = stringValue(payload.name) ?? ''

      if (!email || !token || !userId) {
        options.logger.warn(
          { eventId: event.id, type: event.type },
          'invalid user.email_verification_requested payload',
        )
        return
      }

      await options.emailQueue.add(
        EMAIL_JOB_NAMES.VERIFY_EMAIL,
        {
          to: email,
          template: 'verify-email',
          locale,
          vars: {
            name,
            url: `${options.appUrl}/verify-email?token=${encodeURIComponent(token)}`,
          },
        },
        { jobId: `verify-email-${userId}-${token}` },
      )
      return
    }
    case 'user.password_reset_requested': {
      const email = stringValue(payload.email)
      const token = stringValue(payload.token)
      const locale = stringValue(payload.locale) ?? 'en'

      if (!email || !token) {
        options.logger.warn(
          { eventId: event.id, type: event.type },
          'invalid user.password_reset_requested payload',
        )
        return
      }

      await options.emailQueue.add(
        EMAIL_JOB_NAMES.RESET_PASSWORD,
        {
          to: email,
          template: 'reset-password',
          locale,
          vars: {
            url: `${options.appUrl}/reset-password?token=${encodeURIComponent(token)}`,
          },
        },
        { jobId: `reset-password-${token}` },
      )
      return
    }
    default:
      options.logger.warn({ eventId: event.id, type: event.type }, 'unhandled outbox event')
  }
}
