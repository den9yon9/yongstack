import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { verifyPassword } from '@yongstack/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { createAdmin, createAuditLog, createFile, createUser, DEFAULT_PASSWORD } from './index'

let db: Db

beforeAll(async () => {
  db = await prepareTestDb()
})

afterAll(async () => {
  if (db) await closeDb(db)
})

beforeEach(async () => {
  await resetDb(db)
  await db
    .insert(schema.roles)
    .values([
      { code: 'member', name: 'Member', isSystem: true },
      { code: 'admin', name: 'Admin', isSystem: true },
    ])
    .onConflictDoNothing()
})

async function roleCodes(userId: string): Promise<string[]> {
  const rows = await db
    .select({ code: schema.roles.code })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(eq(schema.userRoles.userId, userId))
  return rows.map((row) => row.code).sort()
}

describe('testkit', () => {
  test('creates users with a hashed password and role', async () => {
    const { user, password } = await createUser(db)
    expect(password).toBe(DEFAULT_PASSWORD)
    if (user.passwordHash === null) throw new Error('expected password hash')
    expect(await verifyPassword(password, user.passwordHash)).toBe(true)
    expect(await roleCodes(user.id)).toEqual(['member'])
  })

  test('creates admins', async () => {
    const { user } = await createAdmin(db, { email: 'admin@example.com' })
    expect(user.email).toBe('admin@example.com')
    expect(await roleCodes(user.id)).toEqual(['admin'])
  })

  test('creates files and audit logs', async () => {
    const { user } = await createUser(db)
    const file = await createFile(db, { ownerId: user.id })
    expect(file.key.startsWith('media/')).toBe(true)
    expect(file.ownerId).toBe(user.id)

    const log = await createAuditLog(db, { actorId: user.id, action: 'test.created' })
    expect(log.action).toBe('test.created')
    expect(log.actorId).toBe(user.id)
  })
})
