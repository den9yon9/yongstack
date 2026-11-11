import { describe, expect, test } from 'bun:test'

import type { StorageEnv } from './env'
import { createS3Client, createS3Storage } from './s3'
import { createInMemoryStorage } from './testing'

const env: StorageEnv = {
  STORAGE_ENDPOINT: 'http://localhost:8333',
  STORAGE_REGION: 'us-east-1',
  STORAGE_BUCKET: 'yongstack',
  STORAGE_ACCESS_KEY_ID: 'admin',
  STORAGE_SECRET_ACCESS_KEY: 'secret',
  STORAGE_FORCE_PATH_STYLE: true,
  STORAGE_PUBLIC_BASE_URL: 'https://img.test/',
  STORAGE_KEY_PREFIX: 'media',
}

describe('createS3Storage', () => {
  test('builds stable keys and public URLs', () => {
    const storage = createS3Storage(env)
    const key = storage.createKey('png')
    expect(key).toMatch(/^media\/[0-9a-f-]+\.png$/)
    expect(storage.publicUrl(key)).toBe(`https://img.test/${key}`)
  })

  test('presigns PUT uploads with the declared content type', async () => {
    const storage = createS3Storage(env)
    const key = storage.createKey('png')
    const result = await storage.presignPut(key, 'image/png', 120)
    expect(result.isOk()).toBe(true)
    if (result.isErr()) return
    expect(result.value).toContain('X-Amz-Signature')
    expect(result.value).toContain(key)
  })

  test('requires credentials when a custom endpoint is configured', () => {
    expect(() =>
      createS3Client({
        ...env,
        STORAGE_ACCESS_KEY_ID: undefined,
        STORAGE_SECRET_ACCESS_KEY: undefined,
      }),
    ).toThrow(/STORAGE_ENDPOINT requires/)
  })
})

describe('createInMemoryStorage', () => {
  test('stores and deletes objects', async () => {
    const storage = createInMemoryStorage({ publicBaseUrl: 'https://img.test' })
    const key = storage.createKey('webp')
    const stored = await storage.put(key, Uint8Array.from([1, 2, 3]), 'image/webp')
    expect(stored.isOk()).toBe(true)
    expect(storage.objects.get(key)?.contentType).toBe('image/webp')
    expect(storage.publicUrl(key)).toBe(`https://img.test/${key}`)

    const deleted = await storage.delete(key)
    expect(deleted.isOk()).toBe(true)
    expect(storage.objects.has(key)).toBe(false)
  })

  test('presigns uploads and reads object metadata', async () => {
    const storage = createInMemoryStorage({ publicBaseUrl: 'https://img.test' })
    const key = storage.createKey('png')

    const presigned = await storage.presignPut(key, 'image/png', 120)
    expect(presigned.isOk()).toBe(true)
    if (presigned.isErr()) return
    expect(presigned.value).toBe(`https://img.test/${key}?signed=put`)

    expect((await storage.head(key)).isErr()).toBe(true)

    await storage.put(key, Uint8Array.from([1, 2, 3, 4]), 'image/png')
    const head = await storage.head(key)
    expect(head.isOk()).toBe(true)
    if (head.isErr()) return
    expect(head.value).toEqual({ size: 4, contentType: 'image/png' })
  })
})

describe('presigned URL checksum', () => {
  test('does not embed automatic CRC32 checksum parameters', async () => {
    const storage = createS3Storage(env)
    const key = storage.createKey('png')
    const result = await storage.presignPut(key, 'image/png', 120)
    if (result.isErr()) throw result.error
    expect(result.value).not.toContain('x-amz-checksum-crc32')
    expect(result.value).not.toContain('x-amz-sdk-checksum-algorithm')
  })
})
