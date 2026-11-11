import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { createUser } from '@yongstack/testkit'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'

import {
  assignDefaultRole,
  assignRoles,
  createRole,
  deleteRole,
  ensureRbacDefaults,
  getRolesForUserIds,
  getUserAccess,
  hasRoleCode,
  listPermissions,
  listRoles,
  listUserIdsByRole,
  setRolePermissions,
  updateRole,
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

describe('custom roles', () => {
  test('creates, updates, sets permissions and deletes a custom role', async () => {
    const created = await createRole(
      { code: 'support', name: 'Support', permissions: ['users:read'] },
      db,
    )
    if (created.isErr()) throw created.error
    expect(created.value).toMatchObject({
      code: 'support',
      name: 'Support',
      isSystem: false,
      permissions: ['users:read'],
    })

    const updated = await updateRole('support', { name: 'Support Team' }, db)
    if (updated.isErr()) throw updated.error
    expect(updated.value.name).toBe('Support Team')

    const perms = await setRolePermissions('support', ['users:read', 'files:read'], db)
    if (perms.isErr()) throw perms.error
    expect(perms.value.permissions).toEqual(['files:read', 'users:read'])

    const user = await seedUser()
    const assigned = await assignRoles(user.id, ['support'], db)
    expect(assigned.isOk()).toBe(true)
    expect(await listUserIdsByRole('support', db)).toEqual([user.id])

    const inUse = await deleteRole('support', db)
    expect(inUse.isErr()).toBe(true)
    if (inUse.isErr()) expect(inUse.error).toBe('ROLE_IN_USE')

    await assignRoles(user.id, ['member'], db)
    const deleted = await deleteRole('support', db)
    expect(deleted.isOk()).toBe(true)
    expect((await listRoles(db)).map((role) => role.code)).toEqual(['admin', 'member'])
  })

  test('rejects duplicate codes and unknown permissions', async () => {
    const duplicate = await createRole({ code: 'member', name: 'Member 2' }, db)
    expect(duplicate.isErr()).toBe(true)
    if (duplicate.isErr()) expect(duplicate.error).toBe('ROLE_CODE_EXISTS')

    const invalid = await createRole(
      { code: 'support', name: 'Support', permissions: ['nope:nope'] },
      db,
    )
    expect(invalid.isErr()).toBe(true)
    if (invalid.isErr()) expect(invalid.error).toBe('PERMISSION_NOT_FOUND')
  })

  test('system roles are read-only', async () => {
    const updated = await updateRole('admin', { name: 'Nope' }, db)
    expect(updated.isErr()).toBe(true)
    if (updated.isErr()) expect(updated.error).toBe('SYSTEM_ROLE_READONLY')

    const perms = await setRolePermissions('member', [], db)
    expect(perms.isErr()).toBe(true)
    if (perms.isErr()) expect(perms.error).toBe('SYSTEM_ROLE_READONLY')

    const deleted = await deleteRole('member', db)
    expect(deleted.isErr()).toBe(true)
    if (deleted.isErr()) expect(deleted.error).toBe('SYSTEM_ROLE_READONLY')
  })
})

describe('ensureRbacDefaults sync', () => {
  test('restores missing defaults without deleting custom permissions', async () => {
    const [adminRole] = await db.select().from(schema.roles).where(eq(schema.roles.code, 'admin'))
    const [memberRole] = await db.select().from(schema.roles).where(eq(schema.roles.code, 'member'))
    const [accessPermission] = await db
      .select()
      .from(schema.permissions)
      .where(eq(schema.permissions.code, 'admin:access'))
    const [usersReadPermission] = await db
      .select()
      .from(schema.permissions)
      .where(eq(schema.permissions.code, 'users:read'))

    await db
      .delete(schema.rolePermissions)
      .where(
        and(
          eq(schema.rolePermissions.roleId, adminRole.id),
          eq(schema.rolePermissions.permissionId, accessPermission.id),
        ),
      )
    await db
      .insert(schema.rolePermissions)
      .values({ roleId: memberRole.id, permissionId: usersReadPermission.id })
      .onConflictDoNothing()

    await ensureRbacDefaults(db)

    const roles = await listRoles(db)
    expect(roles.find((role) => role.code === 'admin')?.permissions).toContain('admin:access')
    expect(roles.find((role) => role.code === 'member')?.permissions).toEqual(
      expect.arrayContaining(['files:read', 'users:read']),
    )
  })
})
