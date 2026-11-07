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
})
