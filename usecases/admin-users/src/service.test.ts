import { closeDb, type Db } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { ensureRbacDefaults, getUserAccess } from '@yongstack/rbac'
import { createUser } from '@yongstack/testkit'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { getUserWithRoles, listUsersWithRoles, updateUserAccess } from './service'

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

async function seedUser(email: string, role: 'member' | 'admin' = 'member') {
  const { user } = await createUser(db, { email, emailVerified: false })
  const access = await updateUserAccess(
    user.id,
    { roles: [role] },
    '00000000-0000-4000-8000-000000000000',
    db,
  )
  if (access.isErr()) throw new Error(access.error)
  return user
}

describe('admin users', () => {
  test('lists users with roles', async () => {
    await seedUser('alice@example.com', 'member')
    await seedUser('boss@example.com', 'admin')

    const page = await listUsersWithRoles({ page: 1, pageSize: 10 }, db)
    expect(page.total).toBe(2)
    expect(page.items.find((user) => user.email === 'boss@example.com')?.roles).toEqual(['admin'])
  })

  test('returns a user with access', async () => {
    const user = await seedUser('alice@example.com')
    const found = await getUserWithRoles(user.id, db)
    if (found.isErr()) throw found.error
    expect(found.value.email).toBe('alice@example.com')
    expect(found.value.roles).toEqual(['member'])
  })

  test('updates roles and status, but not self', async () => {
    const user = await seedUser('alice@example.com')
    const actor = await seedUser('boss@example.com', 'admin')

    const updated = await updateUserAccess(
      user.id,
      { roles: ['member', 'admin'], isActive: false },
      actor.id,
      db,
    )
    if (updated.isErr()) throw updated.error
    expect(updated.value.roles).toEqual(['admin', 'member'])
    expect(updated.value.isActive).toBe(false)

    const access = await getUserAccess(user.id, db)
    expect(access.permissions).toContain('users:write')

    const self = await updateUserAccess(actor.id, { isActive: false }, actor.id, db)
    expect(self._unsafeUnwrapErr()).toBe('SELF_OPERATION')
  })

  test('rejects unknown roles', async () => {
    const user = await seedUser('alice@example.com')
    const actor = await seedUser('boss@example.com', 'admin')
    const result = await updateUserAccess(user.id, { roles: ['ghost'] }, actor.id, db)
    expect(result._unsafeUnwrapErr()).toBe('ROLE_NOT_FOUND')
  })
})
