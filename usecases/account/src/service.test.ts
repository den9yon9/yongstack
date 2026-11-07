import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { ensureRbacDefaults, getUserAccess } from '@yongstack/rbac'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import {
  EMAIL_VERIFICATION_REQUESTED_EVENT,
  PASSWORD_RESET_REQUESTED_EVENT,
  registerAccount,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  USER_REGISTERED_EVENT,
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

describe('registerAccount', () => {
  test('creates the user, assigns member role and records events', async () => {
    const result = await registerAccount(
      { name: 'Alice', email: 'alice@example.com', password: 'password123' },
      db,
      { locale: 'zh-CN' },
    )
    if (result.isErr()) throw result.error

    const access = await getUserAccess(result.value.id, db)
    expect(access.roles).toEqual(['member'])

    const events = await db.select().from(schema.outboxEvents)
    expect(events.map((event) => event.type).sort()).toEqual(
      [EMAIL_VERIFICATION_REQUESTED_EVENT, USER_REGISTERED_EVENT].sort(),
    )

    const verification = events.find((event) => event.type === EMAIL_VERIFICATION_REQUESTED_EVENT)
    expect(verification?.payload).toMatchObject({ email: 'alice@example.com', locale: 'zh-CN' })
    expect(typeof verification?.payload.token).toBe('string')
  })

  test('does not record events when registration fails', async () => {
    await registerAccount(
      { name: 'Alice', email: 'duplicate@example.com', password: 'password123' },
      db,
    )
    const duplicate = await registerAccount(
      { name: 'Bob', email: 'duplicate@example.com', password: 'password123' },
      db,
    )
    expect(duplicate.isErr()).toBe(true)

    const events = await db.select().from(schema.outboxEvents)
    expect(events).toHaveLength(2)
  })
})

describe('verification and reset flows', () => {
  test('verifies email using the outbox token', async () => {
    const registered = await registerAccount(
      { name: 'Alice', email: 'verify@example.com', password: 'password123' },
      db,
    )
    if (registered.isErr()) throw registered.error

    const [event] = await db
      .select()
      .from(schema.outboxEvents)
      .where(eq(schema.outboxEvents.type, EMAIL_VERIFICATION_REQUESTED_EVENT))
    const token = event.payload.token as string

    const verified = await verifyEmail({ token }, db)
    expect(verified._unsafeUnwrap()).toEqual({ userId: registered.value.id })
  })

  test('resends verification only for unverified users', async () => {
    const registered = await registerAccount(
      { name: 'Alice', email: 'resend@example.com', password: 'password123' },
      db,
    )
    if (registered.isErr()) throw registered.error

    const reset = await requestPasswordReset('resend@example.com', db)
    expect(reset.isOk()).toBe(true)

    const verification = await requestEmailVerification(registered.value.id, db)
    expect(verification.isOk()).toBe(true)
  })

  test('issues reset token only for existing users', async () => {
    const missing = await requestPasswordReset('ghost@example.com', db)
    expect(missing.isOk() && missing.value === null).toBe(true)

    await registerAccount(
      { name: 'Alice', email: 'reset@example.com', password: 'password123' },
      db,
    )
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
