import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { createUser } from '@yongstack/testkit'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import {
  attachFile,
  createFile,
  detachFile,
  getFileById,
  getPendingFileForActor,
  listAttachments,
  listFiles,
  listStalePendingFiles,
  markFileReady,
  softDeleteFile,
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
})

async function seedUser(email = 'owner@example.com') {
  const { user } = await createUser(db, { name: 'Owner', email })
  return user
}

async function seedFile(ownerId: string | null = null, key = 'media/a.png', mime = 'image/png') {
  return createFile(
    {
      ownerId: ownerId ?? undefined,
      key,
      url: `https://cdn.example.com/${key}`,
      mime,
      size: 1024,
      width: 1,
      height: 1,
      purpose: 'avatar',
      checksum: 'a'.repeat(64),
      metadata: { originalName: 'a.png' },
    },
    db,
  )
}

describe('files', () => {
  test('creates and reads a file record', async () => {
    const owner = await seedUser()
    const file = await seedFile(owner.id)

    const found = await getFileById(file.id, db)
    if (found.isErr()) throw found.error
    expect(found.value).toMatchObject({
      ownerId: owner.id,
      key: 'media/a.png',
      mime: 'image/png',
      width: 1,
      height: 1,
    })
  })

  test('lists active files with filters', async () => {
    await seedFile(null, 'media/a.png')
    await seedFile(null, 'media/b.jpg', 'image/jpeg')
    await db.insert(schema.files).values({
      key: 'media/c.png',
      url: 'https://cdn.example.com/media/c.png',
      mime: 'image/png',
      size: 10,
      purpose: 'avatar',
    })

    const all = await listFiles({ page: 1, pageSize: 10 }, db)
    expect(all.total).toBe(3)

    const png = await listFiles({ page: 1, pageSize: 10, q: 'png' }, db)
    expect(png.total).toBe(2)
  })

  test('soft deletes a file and hides it', async () => {
    const file = await seedFile()
    const deleted = await softDeleteFile(file.id, db)
    if (deleted.isErr()) throw deleted.error
    expect(deleted.value.key).toBe('media/a.png')

    expect((await getFileById(file.id, db)).isErr()).toBe(true)
    const list = await listFiles({ page: 1, pageSize: 10 }, db)
    expect(list.total).toBe(0)
  })

  test('attaches and detaches files', async () => {
    const owner = await seedUser()
    const file = await seedFile(owner.id)

    await attachFile({ fileId: file.id, ownerType: 'user', ownerId: owner.id, sortOrder: 1 }, db)
    const attachments = await listAttachments('user', owner.id, db)
    expect(attachments).toHaveLength(1)
    expect(attachments[0].file.id).toBe(file.id)

    await detachFile(file.id, 'user', owner.id, db)
    expect(await listAttachments('user', owner.id, db)).toHaveLength(0)
  })

  test('keeps pending uploads hidden until confirmed', async () => {
    const owner = await seedUser()
    const file = await createFile(
      {
        ownerId: owner.id,
        key: 'media/pending.png',
        url: 'https://cdn.example.com/media/pending.png',
        mime: 'image/png',
        size: 0,
        status: 'pending',
      },
      db,
    )

    expect((await getFileById(file.id, db)).isErr()).toBe(true)
    expect((await listFiles({ page: 1, pageSize: 10 }, db)).total).toBe(0)

    const pending = await getPendingFileForActor(file.id, { userId: owner.id, isAdmin: false }, db)
    expect(pending.isOk()).toBe(true)

    const ready = await markFileReady(file.id, { size: 2048, mime: 'image/png' }, db)
    if (ready.isErr()) throw ready.error
    expect(ready.value.status).toBe('ready')

    expect((await listFiles({ page: 1, pageSize: 10 }, db)).total).toBe(1)
  })

  test('lists pending uploads older than the cutoff', async () => {
    const owner = await seedUser()
    await createFile(
      {
        ownerId: owner.id,
        key: 'media/stale.png',
        url: 'https://cdn.example.com/media/stale.png',
        mime: 'image/png',
        size: 0,
        status: 'pending',
      },
      db,
    )

    const stale = await listStalePendingFiles(new Date(Date.now() + 1000), db)
    expect(stale).toHaveLength(1)
    expect(stale[0].key).toBe('media/stale.png')

    const fresh = await listStalePendingFiles(new Date(Date.now() - 60_000), db)
    expect(fresh).toHaveLength(0)
  })
})
