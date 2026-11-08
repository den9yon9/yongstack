import { createLogger } from '@yongstack/shared'
import { describe, expect, test } from 'bun:test'

import { createSmsProvider } from './index'
import { createMemorySmsProvider } from './testing'

describe('sms', () => {
  test('console provider accepts messages', async () => {
    const provider = createSmsProvider(
      { provider: 'console', signName: 'Test' },
      createLogger('silent'),
    )
    const result = await provider.send({ to: '+8613800000000', text: 'hello' })
    expect(result.isOk()).toBe(true)
  })

  test('memory provider captures messages for assertions', async () => {
    const provider = createMemorySmsProvider()
    const result = await provider.send({ to: '+8613800000000', text: 'code 123456' })
    expect(result.isOk()).toBe(true)
    expect(provider.messages).toEqual([{ to: '+8613800000000', text: 'code 123456' }])
  })
})
