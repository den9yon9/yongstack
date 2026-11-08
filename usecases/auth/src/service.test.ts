import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { ensureRbacDefaults } from '@yongstack/rbac'
import { createAdmin, createUser } from '@yongstack/testkit'
import { requestPhoneLoginCode } from '@yongstack/user'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import {
  type ActorMeta,
  loginAdminWithPassword,
  loginAdminWithPhone,
  loginWithPassword,
  loginWithPhone,
  registerAccount,
  requestAdminLoginPhoneCode,
} from './service'

let db: Db

const actorMeta: ActorMeta = { ip: '10.0.0.1', userAgent: 'test-agent', requestId: 'req-1' }

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

async function requireEmailVerification(required: boolean) {
  await db
    .insert(schema.settings)
    .values({ key: 'auth.requireEmailVerification', value: required })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: required } })
}

const PHONE_SECRET = 'test-phone-code-secret'

describe('registerAccount', () => {
  test('creates the user, assigns member role, records events and grants access', async () => {
    const result = await registerAccount(
      { name: 'Alice', email: 'alice@example.com', password: 'password123' },
      db,
      { locale: 'zh-CN' },
    )
    if (result.isErr()) throw result.error
    const { user, access } = result.value

    expect(user.email).toBe('alice@example.com')
    expect(access.roles).toEqual(['member'])
    expect(user.lastLoginAt).not.toBeNull()

    const events = await db.select().from(schema.outboxEvents)
    expect(events.map((event) => event.type).sort()).toEqual(
      ['user.email_verification_requested', 'user.registered'].sort(),
    )
    const verification = events.find((event) => event.type === 'user.email_verification_requested')
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

describe('loginWithPassword', () => {
  test('logs in, persists locale preference and updates last login', async () => {
    const { user } = await createUser(db, {
      email: 'alice@example.com',
      password: 'password123',
    })

    const result = await loginWithPassword(
      { email: 'alice@example.com', password: 'password123' },
      { client: db, locale: 'zh-CN' },
    )
    if (result.isErr()) throw result.error

    expect(result.value.access.roles).toEqual(['member'])
    expect(result.value.user.locale).toBe('zh-CN')
    expect(result.value.user.lastLoginAt).not.toBeNull()

    const [persisted] = await db.select().from(schema.users).where(eq(schema.users.id, user.id))
    expect(persisted?.locale).toBe('zh-CN')
    expect(persisted?.lastLoginAt).not.toBeNull()
  })

  test('returns credentials error without touching session/audit', async () => {
    await createUser(db, { email: 'bob@example.com', password: 'password123' })

    const result = await loginWithPassword(
      { email: 'bob@example.com', password: 'wrong-password' },
      { client: db },
    )
    expect(result._unsafeUnwrapErr()).toBe('LOGIN_FAILED')

    const logs = await db.select().from(schema.auditLogs)
    expect(logs).toHaveLength(0)
  })

  test('blocks unverified email only when the setting is enabled', async () => {
    await createUser(db, { email: 'verify@example.com', emailVerified: false })

    const allowed = await loginWithPassword(
      { email: 'verify@example.com', password: 'password123' },
      { client: db },
    )
    expect(allowed.isOk()).toBe(true)

    await requireEmailVerification(true)
    const blocked = await loginWithPassword(
      { email: 'verify@example.com', password: 'password123' },
      { client: db },
    )
    expect(blocked._unsafeUnwrapErr()).toBe('EMAIL_NOT_VERIFIED')
  })
})

describe('loginAdminWithPassword', () => {
  test('audits failure, forbidden and success paths', async () => {
    const badCredentials = await loginAdminWithPassword(
      { email: 'ghost@example.com', password: 'password123' },
      { client: db, actorMeta },
    )
    expect(badCredentials._unsafeUnwrapErr()).toBe('LOGIN_FAILED')

    await createUser(db, { email: 'member@example.com', password: 'password123' })
    const forbidden = await loginAdminWithPassword(
      { email: 'member@example.com', password: 'password123' },
      { client: db, actorMeta },
    )
    expect(forbidden._unsafeUnwrapErr()).toBe('FORBIDDEN')

    const { user } = await createAdmin(db, {
      email: 'admin@example.com',
      password: 'password123',
    })
    const success = await loginAdminWithPassword(
      { email: 'admin@example.com', password: 'password123' },
      { client: db, actorMeta },
    )
    if (success.isErr()) throw success.error
    expect(success.value.user.id).toBe(user.id)

    const logs = await db.select().from(schema.auditLogs).orderBy(schema.auditLogs.createdAt)
    expect(logs.map((log) => log.action)).toEqual([
      'admin.login.failure',
      'admin.login.failure',
      'admin.login.success',
    ])
  })
})

describe('loginWithPhone', () => {
  test('auto-registers a member on first login', async () => {
    const phone = '+8613800000991'
    const requested = (await requestPhoneLoginCode(phone, PHONE_SECRET, db))._unsafeUnwrap()
    const result = await loginWithPhone(phone, requested.code, {
      client: db,
      secret: PHONE_SECRET,
      locale: 'zh-CN',
    })
    if (result.isErr()) throw result.error

    expect(result.value.access.roles).toEqual(['member'])
    expect(result.value.user.email).toBeNull()
    expect(result.value.user.phoneVerifiedAt).not.toBeNull()

    const [persisted] = await db.select().from(schema.users).where(eq(schema.users.phone, phone))
    expect(persisted?.passwordHash).toBeNull()
    expect(persisted?.lastLoginAt).not.toBeNull()
  })

  test('rejects a bad code without creating the user', async () => {
    const result = await loginWithPhone('+8613800000992', '000000', {
      client: db,
      secret: PHONE_SECRET,
    })
    expect(result._unsafeUnwrapErr()).toBe('CODE_INVALID')

    const rows = await db.select().from(schema.users)
    expect(rows).toHaveLength(0)
  })
})

describe('loginAdminWithPhone', () => {
  test('refuses non-admin or unbound phones; accepts admins', async () => {
    const phone = '+8613800000993'
    await createUser(db, { phone })

    const requested = (
      await requestAdminLoginPhoneCode(phone, db, { secret: PHONE_SECRET })
    )._unsafeUnwrap()
    // 非 admin: 不发码
    expect(requested).toBeNull()

    const denied = await loginAdminWithPhone(phone, '000000', {
      client: db,
      secret: PHONE_SECRET,
    })
    expect(denied._unsafeUnwrapErr()).toBe('CODE_INVALID')

    await createAdmin(db, { phone: '+8613800000994' })
    const adminRequested = (
      await requestAdminLoginPhoneCode('+8613800000994', db, { secret: PHONE_SECRET })
    )._unsafeUnwrap()
    if (adminRequested === null) throw new Error('expected a code for admin phone')

    const success = await loginAdminWithPhone('+8613800000994', adminRequested.code, {
      client: db,
      secret: PHONE_SECRET,
    })
    if (success.isErr()) throw success.error
    expect(success.value.access.roles).toEqual(['admin'])
  })
})
