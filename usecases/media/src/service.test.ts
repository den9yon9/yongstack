import { listAuditLogs } from '@yongstack/audit'
import { closeDb, type Db, type DbClient } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import type { File } from '@yongstack/file'
import { ensureRbacDefaults } from '@yongstack/rbac'
import { createLogger, err, ok } from '@yongstack/shared'
import { createUser } from '@yongstack/testkit'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import {
  confirmMediaUpload,
  type MediaContext,
  type MediaStorage,
  presignMediaUpload,
  softDeleteMedia,
  uploadMedia,
} from './service'

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

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
    async put(key, body, contentType) {
      objects.set(key, { size: body.byteLength, contentType })
      return ok(undefined)
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

async function context(
  actor?: { userId: string; canAccessAny: boolean },
  client: DbClient = db,
): Promise<MediaContext> {
  const { user } = await createUser(db, { name: 'Admin', email: 'admin@example.com' })
  return {
    storage: createFakeStorage(),
    db: client,
    actor: actor ?? { userId: user.id, canAccessAny: false },
    meta: {},
    logger: createLogger('silent'),
    auditAction: {
      upload: 'test.file.upload',
      presign: 'test.file.presign',
      confirm: 'test.file.confirm',
      delete: 'test.file.delete',
    },
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

    const audits = await listAuditLogs({ page: 1, pageSize: 20 }, db)
    const presignAudits = audits.items.filter((row) => row.action === 'test.file.presign')
    expect(presignAudits).toHaveLength(1)
    expect(presignAudits[0]?.targetId).toBe(presigned.value.fileId)
  })

  test('maps declared MIME to a canonical extension without trusting filenames', async () => {
    const ctx = await context()
    const jpeg = await presignMediaUpload(
      { filename: 'not-an-html.html', mime: 'image/jpeg', size: 3 },
      ctx,
    )
    if (jpeg.isErr()) throw jpeg.error
    expect(jpeg.value.key).toMatch(/\.jpg$/)
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

describe('uploadMedia (server-side)', () => {
  test('validates magic bytes, stores the object and writes metadata', async () => {
    const ctx = await context()
    const uploaded = await uploadMedia(
      { data: TINY_PNG, originalName: 'avatar.png', purpose: 'avatar' },
      ctx,
    )
    if (uploaded.isErr()) throw uploaded.error
    const file = uploaded.value
    expect(file.mime).toBe('image/png')
    expect(file.status).toBe('ready')
    expect(file.checksum).toHaveLength(64)
    expect(file.purpose).toBe('avatar')
    expect(file.width).toBe(1)
    expect(file.height).toBe(1)

    const storage = ctx.storage as ReturnType<typeof createFakeStorage>
    expect(storage.objects.get(file.key)).toMatchObject({ contentType: 'image/png' })
  })

  test('rejects oversized and unparsable content', async () => {
    const ctx = await context()
    const oversized = new Uint8Array(6 * 1024 * 1024)
    oversized.set(TINY_PNG.subarray(0, 16))
    expect(await uploadMedia({ data: oversized, originalName: 'big.png' }, ctx)).toMatchObject({
      isErr: () => true,
    })

    const text = await uploadMedia(
      { data: new TextEncoder().encode('not an image'), originalName: 'a.txt' },
      ctx,
    )
    expect(text.isErr()).toBe(true)
    if (text.isErr()) expect(text.error).toBe('FILE_TYPE_NOT_ALLOWED')
  })

  test('cleans up the stored object when metadata write fails', async () => {
    const brokenDb = new Proxy(db, {
      get(target, property, receiver) {
        if (property === 'transaction') {
          return async () => {
            throw new Error('db down')
          }
        }
        const value = Reflect.get(target, property, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      },
    }) as DbClient

    const ctx = await context(undefined, brokenDb)
    const result = await uploadMedia({ data: TINY_PNG, originalName: 'orphan.png' }, ctx)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error).toBe('INTERNAL_ERROR')

    const storage = ctx.storage as ReturnType<typeof createFakeStorage>
    expect(storage.objects.size).toBe(0)
  })

  test('soft deletes metadata and the stored object', async () => {
    const ctx = await context()
    const uploaded = await uploadMedia({ data: TINY_PNG, originalName: 'delete.png' }, ctx)
    if (uploaded.isErr()) throw uploaded.error
    const file: File = uploaded.value

    const deleted = await softDeleteMedia(file.id, ctx)
    expect(deleted.isOk()).toBe(true)

    const storage = ctx.storage as ReturnType<typeof createFakeStorage>
    expect(storage.objects.has(file.key)).toBe(false)

    const again = await softDeleteMedia(file.id, ctx)
    expect(again.isErr()).toBe(true)
    if (again.isErr()) expect(again.error).toBe('FILE_NOT_FOUND')
  })
})
