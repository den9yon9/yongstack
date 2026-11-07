import { createLogger } from '@yongstack/shared'
import { describe, expect, test } from 'bun:test'

import { createMailer } from './index'

describe('createMailer', () => {
  test('console transport sends successfully', async () => {
    const mailer = createMailer(
      { transport: 'console', from: 'Yongstack <no-reply@example.com>' },
      createLogger('silent'),
    )
    const result = await mailer.send({
      to: 'alice@example.com',
      subject: 'Welcome',
      text: 'Hello',
    })
    expect(result.isOk()).toBe(true)
  })

  test('smtp transport requires host and port', () => {
    expect(() =>
      createMailer(
        { transport: 'smtp', from: 'Yongstack <no-reply@example.com>' },
        createLogger('silent'),
      ),
    ).toThrow(/SMTP_HOST/)
  })
})
