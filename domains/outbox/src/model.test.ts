import { describe, expect, test } from 'bun:test'

import { OutboxEventResponseSchema } from './model'

const FIELDS = [
  'attempts',
  'availableAt',
  'createdAt',
  'id',
  'lastError',
  'processedAt',
  'requestId',
  'status',
  'type',
  'updatedAt',
].sort()

describe('OutboxEventResponseSchema', () => {
  test('列表只暴露运维需要的字段', () => {
    expect(Object.keys(OutboxEventResponseSchema.properties).sort()).toEqual(FIELDS)
  })

  test('不把 payload(含明文 token) 带进列表契约', () => {
    expect(Object.keys(OutboxEventResponseSchema.properties)).not.toContain('payload')
  })
})
