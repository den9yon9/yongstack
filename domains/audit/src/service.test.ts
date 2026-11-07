import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { listAuditLogs, recordAudit } from './service'

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

async function seedUser(email = 'admin@example.com') {
  const [user] = await db
    .insert(schema.users)
    .values({ name: 'Admin', email, passwordHash: 'not-a-real-hash' })
    .returning()
  return user
}

describe('audit', () => {
  test('records and lists audit logs', async () => {
    const actor = await seedUser()
    await recordAudit(
      {
        actorId: actor.id,
        action: 'admin.user.update',
        targetType: 'user',
        targetId: 'u-1',
        diff: { roles: ['admin'] },
        ip: '127.0.0.1',
        requestId: 'req-1',
      },
      db,
    )
    await recordAudit(
      { actorId: actor.id, action: 'admin.settings.update', targetType: 'settings' },
      db,
    )

    const all = await listAuditLogs({ page: 1, pageSize: 10 }, db)
    expect(all.total).toBe(2)

    const filtered = await listAuditLogs({ page: 1, pageSize: 10, action: 'admin.user.update' }, db)
    expect(filtered.total).toBe(1)
    expect(filtered.items[0].targetId).toBe('u-1')
    expect(filtered.items[0].diff).toEqual({ roles: ['admin'] })
  })

  test('supports keyword and target filters', async () => {
    const actor = await seedUser()
    await recordAudit(
      { actorId: actor.id, action: 'admin.file.delete', targetType: 'file', targetId: 'f-1' },
      db,
    )
    await recordAudit(
      { actorId: actor.id, action: 'admin.user.update', targetType: 'user', targetId: 'u-1' },
      db,
    )

    const byQuery = await listAuditLogs({ page: 1, pageSize: 10, q: 'file' }, db)
    expect(byQuery.total).toBe(1)

    const byTarget = await listAuditLogs({ page: 1, pageSize: 10, targetType: 'user' }, db)
    expect(byTarget.total).toBe(1)
    expect(byTarget.items[0].action).toBe('admin.user.update')
  })

  test('paginates', async () => {
    const actor = await seedUser()
    for (let i = 0; i < 3; i += 1) {
      await recordAudit(
        { actorId: actor.id, action: 'test.event', targetType: 'test', targetId: `t-${i}` },
        db,
      )
    }

    const first = await listAuditLogs({ page: 1, pageSize: 2 }, db)
    expect(first.items).toHaveLength(2)
    expect(first.total).toBe(3)
    const second = await listAuditLogs({ page: 2, pageSize: 2 }, db)
    expect(second.items).toHaveLength(1)
  })
})
