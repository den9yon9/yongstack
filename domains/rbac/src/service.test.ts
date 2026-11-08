import { closeDb, type Db } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { createUser } from '@yongstack/testkit'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import {
  assignDefaultRole,
  assignRoles,
  ensureRbacDefaults,
  getRolesForUserIds,
  getUserAccess,
  hasRoleCode,
  listPermissions,
  listRoles,
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

async function seedUser(email = 'alice@example.com') {
  const { user } = await createUser(db, { name: 'Alice', email })
  return user
}

describe('rbac', () => {
  test('ensures default roles and permissions', async () => {
    const roles = await listRoles(db)
    expect(roles.map((role) => role.code)).toEqual(['admin', 'member'])
    expect(roles.find((role) => role.code === 'admin')?.permissions).toContain('users:read')
    expect(roles.find((role) => role.code === 'member')?.permissions).toEqual(['files:read'])

    const permissions = await listPermissions(db)
    expect(permissions.map((permission) => permission.code)).toContain('users:write')
  })

  test('assigns the default member role', async () => {
    const user = await seedUser()
    await assignDefaultRole(user.id, db)

    const access = await getUserAccess(user.id, db)
    expect(access.roles).toEqual(['member'])
    expect(access.permissions).toEqual(['files:read'])
    expect(await hasRoleCode(user.id, 'member', db)).toBe(true)
  })

  test('replaces roles and returns the new access', async () => {
    const user = await seedUser()
    await assignDefaultRole(user.id, db)

    const result = await assignRoles(user.id, ['member', 'admin'], db)
    if (result.isErr()) throw result.error
    expect(result.value.roles).toEqual(['admin', 'member'])
    expect(result.value.permissions).toContain('users:write')

    const map = await getRolesForUserIds([user.id], db)
    expect(map.get(user.id)).toEqual(['admin', 'member'])
  })

  test('rejects unknown roles and empty role sets', async () => {
    const user = await seedUser()
    const unknown = await assignRoles(user.id, ['ghost'], db)
    expect(unknown._unsafeUnwrapErr()).toBe('ROLE_NOT_FOUND')

    const empty = await assignRoles(user.id, [], db)
    expect(empty._unsafeUnwrapErr()).toBe('ROLE_NOT_FOUND')
  })
})
