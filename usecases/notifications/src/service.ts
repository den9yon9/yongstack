import type { OutboxEvent, OutboxEventMap, OutboxEventName } from '@yongstack/outbox'
import type { Queue } from '@yongstack/queue'
import type { Logger } from '@yongstack/shared'

import { EMAIL_JOB_NAMES, type SendEmailJobData } from './jobs'

export interface NotificationDispatchOptions {
  emailQueue: Queue<SendEmailJobData>
  appUrl: string
  logger: Logger
}

// payload 从 jsonb 读回, 类型退化为 Record<string, unknown>;
// 校验失败抛错 → worker markFailed 重试直到终态, 不再静默 markDelivered 丢事件。
export class OutboxPayloadError extends Error {
  constructor(eventId: string, type: string) {
    super(`invalid payload for outbox event ${type} (${eventId})`)
    this.name = 'OutboxPayloadError'
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

type PayloadOf<T extends OutboxEventName> = OutboxEventMap[T]

// 逐字段窄化; 返回 null 表示 payload 与注册表不符(字段缺失/漂移)。
function parse<P extends Record<string, unknown>>(
  payload: Record<string, unknown>,
  spec: { [K in keyof P]-?: (value: unknown) => P[K] | null },
): P | null {
  const parsed = {} as P
  for (const key in spec) {
    const value = spec[key](payload[key])
    if (value === null) return null
    parsed[key as keyof P] = value as P[keyof P]
  }
  return parsed
}

// 事件 → 通知渠道的映射层。模板渲染与发送在 worker(呈现层)完成。
export async function dispatchOutboxEvent(
  event: OutboxEvent,
  options: NotificationDispatchOptions,
): Promise<void> {
  switch (event.type) {
    case 'user.registered': {
      const payload = parse<PayloadOf<'user.registered'>>(event.payload, {
        userId: stringValue,
        email: stringValue,
        name: (v) => (stringValue(v) ?? null) as string | null,
        locale: (v) => stringValue(v) ?? 'en',
      })

      if (!payload) throw new OutboxPayloadError(event.id, event.type)

      await options.emailQueue.add(
        EMAIL_JOB_NAMES.WELCOME,
        {
          to: payload.email,
          template: 'welcome',
          locale: payload.locale,
          vars: { name: payload.name ?? '', appUrl: options.appUrl },
        },
        { jobId: `welcome-${payload.userId}` },
      )
      return
    }
    case 'user.email_verification_requested': {
      const payload = parse<PayloadOf<'user.email_verification_requested'>>(event.payload, {
        userId: stringValue,
        email: stringValue,
        token: stringValue,
        name: (v) => (stringValue(v) ?? '') as string,
        locale: (v) => stringValue(v) ?? 'en',
      })

      if (!payload) throw new OutboxPayloadError(event.id, event.type)

      await options.emailQueue.add(
        EMAIL_JOB_NAMES.VERIFY_EMAIL,
        {
          to: payload.email,
          template: 'verify-email',
          locale: payload.locale,
          vars: {
            name: payload.name ?? '',
            url: `${options.appUrl}/verify-email?token=${encodeURIComponent(payload.token)}`,
          },
        },
        { jobId: `verify-email-${payload.userId}-${payload.token}` },
      )
      return
    }
    case 'user.password_reset_requested': {
      const payload = parse<PayloadOf<'user.password_reset_requested'>>(event.payload, {
        email: stringValue,
        token: stringValue,
        locale: (v) => stringValue(v) ?? 'en',
      })

      if (!payload) throw new OutboxPayloadError(event.id, event.type)

      await options.emailQueue.add(
        EMAIL_JOB_NAMES.RESET_PASSWORD,
        {
          to: payload.email,
          template: 'reset-password',
          locale: payload.locale,
          vars: {
            url: `${options.appUrl}/reset-password?token=${encodeURIComponent(payload.token)}`,
          },
        },
        { jobId: `reset-password-${payload.token}` },
      )
      return
    }
    // 未注册的事件类型按 payload 错误处理: 醒目可见 + 可追溯终态, 不再静默丢弃。
    default:
      throw new OutboxPayloadError(event.id, event.type)
  }
}
