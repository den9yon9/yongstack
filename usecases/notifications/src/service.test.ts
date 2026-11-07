import type { OutboxEvent } from '@yongstack/outbox'
import type { Queue } from '@yongstack/queue'
import { createLogger } from '@yongstack/shared'
import { describe, expect, test } from 'bun:test'

import { EMAIL_JOB_NAMES, type SendEmailJobData } from './jobs'
import { dispatchOutboxEvent } from './service'

function createFakeQueue() {
  const jobs: { name: string; data: SendEmailJobData; opts?: unknown }[] = []
  const queue = {
    async add(name: string, data: SendEmailJobData, opts?: unknown) {
      jobs.push({ name, data, opts })
    },
  } as unknown as Queue<SendEmailJobData>
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

  test('ignores unknown event types and invalid payloads', async () => {
    const { queue, jobs } = createFakeQueue()
    const logger = createLogger('silent')

    await dispatchOutboxEvent(event({ type: 'unknown.event' }), {
      emailQueue: queue,
      appUrl: 'https://app.example.com',
      logger,
    })
    await dispatchOutboxEvent(event({ payload: {} }), {
      emailQueue: queue,
      appUrl: 'https://app.example.com',
      logger,
    })

    expect(jobs).toHaveLength(0)
  })
})
