import { listAuditLogs } from '@yongstack/audit'
import { closeDb, type Db } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { assignRoles, ensureRbacDefaults } from '@yongstack/rbac'
import { createUser } from '@yongstack/testkit'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import {
  createRoleWithAudit,
  deleteRoleWithAudit,
  setRolePermissionsWithAudit,
  updateRoleWithAudit,
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

async function seedActor() {
  const { user } = await createUser(db, { name: 'Admin', email: 'admin@example.com' })
  return user
}

describe('admin roles', () => {
  test('creates, updates, grants and deletes with audit trail', async () => {
    const actor = await seedActor()

    const created = await createRoleWithAudit(
      { code: 'support', name: 'Support', permissions: ['users:read'] },
      actor.id,
      db,
    )
    if (created.isErr()) throw created.error
    expect(created.value.permissions).toEqual(['users:read'])

    const updated = await updateRoleWithAudit('support', { name: 'Support Team' }, actor.id, db)
    if (updated.isErr()) throw updated.error
    expect(updated.value.name).toBe('Support Team')

    const { user } = await createUser(db, { name: 'Member', email: 'member@example.com' })
    await assignRoles(user.id, ['support'], db)

    const changed = await setRolePermissionsWithAudit('support', ['files:read'], actor.id, db)
    if (changed.isErr()) throw changed.error
    expect(changed.value.role.permissions).toEqual(['files:read'])
    expect(changed.value.affectedUserIds).toEqual([user.id])

    const audits = await listAuditLogs({ page: 1, pageSize: 20 }, db)
    const actions = audits.items.map((row) => row.action)
    expect(actions).toContain('admin.role.create')
    expect(actions).toContain('admin.role.update')
    expect(actions).toContain('admin.role.permissions.update')

    await assignRoles(user.id, ['member'], db)
    const deleted = await deleteRoleWithAudit('support', actor.id, db)
    expect(deleted.isOk()).toBe(true)
  })

  test('returns role errors without writing audit on failure', async () => {
    const actor = await seedActor()
    const res = await deleteRoleWithAudit('admin', actor.id, db)
    expect(res.isErr()).toBe(true)
    if (res.isErr()) expect(res.error).toBe('SYSTEM_ROLE_READONLY')

    const audits = await listAuditLogs({ page: 1, pageSize: 20 }, db)
    expect(audits.items).toHaveLength(0)
  })
})
