import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { assignDefaultRole, ensureRbacDefaults } from '@yongstack/rbac'
import { registerUser } from '@yongstack/user'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import {
  PASSWORD_RESET_REQUESTED_EVENT,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
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

// 测试夹具: 建号 + 赋予默认角色(注册编排的完整流程在 usecases/auth 测试覆盖)
async function seedUser(email: string, locale?: string) {
  const result = await registerUser(
    { name: 'Alice', email, password: 'password123' },
    db,
    locale === undefined ? {} : { locale },
  )
  if (result.isErr()) throw result.error
  await assignDefaultRole(result.value.id, db)
  return result.value
}

describe('verification and reset flows', () => {
  test('verifies email using the outbox token', async () => {
    const user = await seedUser('verify@example.com')

    const requested = await requestEmailVerification(user.id, db)
    if (requested.isErr() || requested.value === null) throw new Error('expected token')
    const verified = await verifyEmail({ token: requested.value.token }, db)
    expect(verified._unsafeUnwrap()).toEqual({ userId: user.id })
  })

  test('resends verification only for unverified users', async () => {
    const user = await seedUser('resend@example.com')

    const reset = await requestPasswordReset('resend@example.com', db)
    expect(reset.isOk()).toBe(true)

    const verification = await requestEmailVerification(user.id, db)
    expect(verification.isOk()).toBe(true)
  })

  test('issues reset token only for existing users', async () => {
    const missing = await requestPasswordReset('ghost@example.com', db)
    expect(missing.isOk() && missing.value === null).toBe(true)

    await seedUser('reset@example.com')
    const created = await requestPasswordReset('reset@example.com', db)
    if (created.isErr() || created.value === null) throw new Error('expected token')

    const events = await db.select().from(schema.outboxEvents)
    expect(events.some((event) => event.type === PASSWORD_RESET_REQUESTED_EVENT)).toBe(true)

    const resetResult = await resetPassword(
      { token: created.value.token, password: 'new-password-2' },
      db,
    )
    expect(resetResult.isOk()).toBe(true)
  })
})
