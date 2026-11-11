import { closeDb, type Db } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { ensureRbacDefaults } from '@yongstack/rbac'
import { err, ok } from '@yongstack/shared'
import { createUser } from '@yongstack/testkit'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import {
  confirmMediaUpload,
  type MediaContext,
  type MediaStorage,
  presignMediaUpload,
} from './service'

let db: Db

beforeAll(async () => {
  db = await prepareTestDb()
})

afterAll(async () => {
  if (db) await closeDb(db)
})

beforeEach(async () => {
  await resetDb(db)
  await ensureRbacDefaults(db)
})

function createFakeStorage(): MediaStorage & {
  objects: Map<string, { size: number; contentType: string }>
} {
  const objects = new Map<string, { size: number; contentType: string }>()
  return {
    objects,
    createKey(extension) {
      return `media/${crypto.randomUUID()}.${extension}`
    },
    publicUrl(key) {
      return `https://img.test/${key}`
    },
    async presignPut(key) {
      return ok(`https://upload.test/${key}`)
    },
    async head(key) {
      const object = objects.get(key)
      return object === undefined ? err('STORAGE_UNAVAILABLE') : ok(object)
    },
    async delete(key) {
      objects.delete(key)
      return ok(undefined)
    },
  }
}

async function context(actor?: { userId: string; isAdmin: boolean }): Promise<MediaContext> {
  const { user } = await createUser(db, { name: 'Admin', email: 'admin@example.com' })
  return {
    storage: createFakeStorage(),
    db,
    actor: actor ?? { userId: user.id, isAdmin: false },
    meta: {},
    auditAction: { presign: 'test.file.presign', confirm: 'test.file.confirm' },
  }
}

describe('media upload', () => {
  test('presigns and confirms an image upload', async () => {
    const ctx = await context()
    const presigned = await presignMediaUpload(
      { filename: 'avatar.png', mime: 'image/png', size: 3 },
      ctx,
    )
    if (presigned.isErr()) throw presigned.error
    expect(presigned.value.key).toMatch(/^media\/.+\.png$/)

    const storage = ctx.storage as ReturnType<typeof createFakeStorage>
    storage.objects.set(presigned.value.key, { size: 3, contentType: 'image/png' })

    const confirmed = await confirmMediaUpload(presigned.value.fileId, {}, ctx)
    if (confirmed.isErr()) throw confirmed.error
    expect(confirmed.value.status).toBe('ready')
    expect(confirmed.value.mime).toBe('image/png')
  })

  test('rejects files over 5MB and disallowed types', async () => {
    const ctx = await context()
    const tooLarge = await presignMediaUpload(
      { filename: 'big.png', mime: 'image/png', size: 6 * 1024 * 1024 },
      ctx,
    )
    expect(tooLarge.isErr()).toBe(true)
    if (tooLarge.isErr()) expect(tooLarge.error).toBe('FILE_TOO_LARGE')

    const wrongType = await presignMediaUpload(
      { filename: 'a.zip', mime: 'application/zip', size: 10 },
      ctx,
    )
    expect(wrongType.isErr()).toBe(true)
    if (wrongType.isErr()) expect(wrongType.error).toBe('FILE_TYPE_NOT_ALLOWED')
  })

  test('allows PDF assets', async () => {
    const ctx = await context()
    const pdf = await presignMediaUpload(
      { filename: 'manual.pdf', mime: 'application/pdf', size: 10 },
      ctx,
    )
    expect(pdf.isOk()).toBe(true)
  })
})
