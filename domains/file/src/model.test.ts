import { describe, expect, test } from 'bun:test'

import { FileResponseSchema } from './model'

const FIELDS = [
  'checksum',
  'createdAt',
  'height',
  'id',
  'key',
  'metadata',
  'mime',
  'ownerId',
  'purpose',
  'size',
  'updatedAt',
  'url',
  'width',
].sort()

describe('FileResponseSchema', () => {
  test('只暴露客户端需要的文件字段', () => {
    expect(Object.keys(FileResponseSchema.properties).sort()).toEqual(FIELDS)
  })

  test('不包含内部状态字段', () => {
    const keys = Object.keys(FileResponseSchema.properties)

    expect(keys).not.toContain('status')
    expect(keys).not.toContain('deletedAt')
  })
})
