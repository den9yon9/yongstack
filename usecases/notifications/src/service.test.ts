import type { OutboxEvent } from '@yongstack/outbox'
import { createLogger } from '@yongstack/shared'
import { describe, expect, test } from 'bun:test'

import { EMAIL_JOB_NAMES, type SendEmailJobData } from './jobs'
import { dispatchOutboxEvent, type EmailJobQueue, OutboxPayloadError } from './service'

function createFakeQueue() {
  const jobs: { name: string; data: SendEmailJobData; opts?: unknown }[] = []
  const queue: EmailJobQueue = {
    async add(name, data, opts) {
      jobs.push({ name, data, opts })
    },
  }
  return { queue, jobs }
}

function event(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    id: 'e-1',
    type: 'user.registered',
    payload: { userId: 'u-1', email: 'alice@example.com', name: 'Alice', locale: 'zh-CN' },
    attempts: 0,
    ...overrides,
  }
}

describe('dispatchOutboxEvent', () => {
  test('maps user.registered to a deterministic welcome email job', async () => {
    const { queue, jobs } = createFakeQueue()
    await dispatchOutboxEvent(event(), {
      emailQueue: queue,
      appUrl: 'https://app.example.com',
      logger: createLogger('silent'),
    })

    expect(jobs).toHaveLength(1)
    expect(jobs[0].name).toBe(EMAIL_JOB_NAMES.WELCOME)
    expect(jobs[0].data).toMatchObject({
      to: 'alice@example.com',
      template: 'welcome',
      locale: 'zh-CN',
      vars: { name: 'Alice', appUrl: 'https://app.example.com' },
    })
    expect(jobs[0].opts).toMatchObject({ jobId: 'welcome-u-1' })
  })

  test('maps verification and reset events to link emails', async () => {
    const { queue, jobs } = createFakeQueue()
    const options = {
      emailQueue: queue,
      appUrl: 'https://app.example.com',
      logger: createLogger('silent'),
    }

    await dispatchOutboxEvent(
      event({
        type: 'user.email_verification_requested',
        payload: {
          userId: 'u-1',
          email: 'alice@example.com',
          name: 'Alice',
          token: 'verify-token',
          locale: 'en',
        },
      }),
      options,
    )
    await dispatchOutboxEvent(
      event({
        type: 'user.password_reset_requested',
        payload: { email: 'alice@example.com', token: 'reset-token', locale: 'en' },
      }),
      options,
    )

    expect(jobs).toHaveLength(2)
    expect(jobs[0].name).toBe(EMAIL_JOB_NAMES.VERIFY_EMAIL)
    expect(jobs[0].data.vars.url).toBe('https://app.example.com/verify-email?token=verify-token')
    expect(jobs[1].name).toBe(EMAIL_JOB_NAMES.RESET_PASSWORD)
    expect(jobs[1].data.vars.url).toBe('https://app.example.com/reset-password?token=reset-token')
  })

  test('throws on unknown event types or payload drift so the worker can mark it failed', async () => {
    const { queue, jobs } = createFakeQueue()
    const options = {
      emailQueue: queue,
      appUrl: 'https://app.example.com',
      logger: createLogger('silent'),
    }

    await expect(
      dispatchOutboxEvent(event({ type: 'unknown.event' }), options),
    ).rejects.toBeInstanceOf(OutboxPayloadError)
    // 注册过的字段缺失视为漂移
    await expect(
      dispatchOutboxEvent(event({ payload: { userId: 'u-1' } }), options),
    ).rejects.toBeInstanceOf(OutboxPayloadError)

    expect(jobs).toHaveLength(0)
  })
})
