import { describe, expect, test } from 'bun:test'

import { AuditLogResponseSchema } from './model'

const FIELDS = [
  'action',
  'actorId',
  'createdAt',
  'id',
  'ip',
  'requestId',
  'targetId',
  'targetType',
].sort()

describe('AuditLogResponseSchema', () => {
  test('列表只暴露事件溯源字段', () => {
    expect(Object.keys(AuditLogResponseSchema.properties).sort()).toEqual(FIELDS)
  })

  test('不把任意形状字段带进列表契约', () => {
    const keys = Object.keys(AuditLogResponseSchema.properties)

    expect(keys).not.toContain('diff')
    expect(keys).not.toContain('userAgent')
  })
})
