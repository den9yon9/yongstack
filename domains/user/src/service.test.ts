import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import {
  bindPhone,
  changePassword,
  CodeRequestedTooSoonError,
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  createPasswordResetToken,
  createPhoneUser,
  findUserByPhone,
  getUserById,
  listUsers,
  loginUser,
  pruneExpiredUserTokens,
  registerUser,
  requestPhoneLoginCode,
  unbindPhone,
  updateLastLogin,
  updateProfile,
  updateUserLocale,
  updateUserStatus,
  verifyPhoneLoginCode,
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

async function register(email = 'alice@example.com', name = 'Alice') {
  const result = await registerUser({ name, email, password: 'secret123' }, db)
  if (result.isErr()) throw result.error
  return result.value
}

describe('registerUser', () => {
  test('creates a user with a hashed password', async () => {
    const user = await register()
    expect(user.email).toBe('alice@example.com')
    expect(user.passwordHash).not.toBe('secret123')
    expect(user.emailVerifiedAt).toBeNull()
  })

  test('normalizes email and stores locale', async () => {
    const result = await registerUser(
      { name: 'Alice', email: '  ALICE@Example.com ', password: 'secret123' },
      db,
      { locale: 'zh-CN' },
    )
    if (result.isErr()) throw result.error
    expect(result.value.email).toBe('alice@example.com')
    expect(result.value.locale).toBe('zh-CN')
  })

  test('rejects duplicate email as a business error', async () => {
    await register('a@example.com')
    const duplicate = await registerUser(
      { name: 'Bob', email: 'a@example.com', password: 'secret123' },
      db,
    )
    expect(duplicate._unsafeUnwrapErr()).toBe('EMAIL_ALREADY_REGISTERED')
  })
})

describe('loginUser', () => {
  test('returns the user for valid credentials', async () => {
    await register('a@example.com')
    const result = await loginUser({ email: 'a@example.com', password: 'secret123' }, db)
    expect(result._unsafeUnwrap().email).toBe('a@example.com')
  })

  test('returns LOGIN_FAILED for wrong password and unknown email', async () => {
    await register('a@example.com')
    expect(
      (await loginUser({ email: 'a@example.com', password: 'wrong-pass' }, db))._unsafeUnwrapErr(),
    ).toBe('LOGIN_FAILED')
    expect(
      (
        await loginUser({ email: 'nobody@example.com', password: 'secret123' }, db)
      )._unsafeUnwrapErr(),
    ).toBe('LOGIN_FAILED')
  })

  test('returns ACCOUNT_DISABLED for an inactive user', async () => {
    const user = await register('bob@example.com')
    await updateUserStatus(user.id, { isActive: false }, db)
    const result = await loginUser({ email: 'bob@example.com', password: 'secret123' }, db)
    expect(result._unsafeUnwrapErr()).toBe('ACCOUNT_DISABLED')
  })
})

describe('profile and listing', () => {
  test('updates name and avatar', async () => {
    const user = await register('carol@example.com')
    const updated = await updateProfile(
      user.id,
      { name: 'Carol 2', avatar: 'https://img.example.com/c.png' },
      db,
    )
    if (updated.isErr()) throw updated.error
    expect(updated.value.name).toBe('Carol 2')
    expect(updated.value.avatar).toBe('https://img.example.com/c.png')
  })

  test('lists users with search and status filters', async () => {
    await register('alice@example.com', 'Alice')
    const bob = await register('bob@example.com', 'Bob')
    await register('carol@example.com', 'Carol')
    await updateUserStatus(bob.id, { isActive: false }, db)

    const all = await listUsers({ page: 1, pageSize: 10 }, db)
    expect(all.total).toBe(3)
    expect(all.items).toHaveLength(3)

    const search = await listUsers({ page: 1, pageSize: 10, q: 'bob' }, db)
    expect(search.total).toBe(1)
    expect(search.items[0].email).toBe('bob@example.com')

    const inactive = await listUsers({ page: 1, pageSize: 10, isActive: false }, db)
    expect(inactive.total).toBe(1)
    expect(inactive.items[0].id).toBe(bob.id)
  })

  test('updates locale and last login', async () => {
    const user = await register('locale@example.com')
    await updateUserLocale(user.id, 'zh-CN', db)
    await updateLastLogin(user.id, db)
    const found = await getUserById(user.id, db)
    if (found.isErr()) throw found.error
    expect(found.value.locale).toBe('zh-CN')
    expect(found.value.lastLoginAt).not.toBeNull()
  })
})

describe('email verification tokens', () => {
  test('full cycle marks the email verified and is single-use', async () => {
    const user = await register('verify@example.com')
    const { token } = await createEmailVerificationToken(user.id, db)

    const first = await consumeEmailVerificationToken({ token }, db)
    expect(first._unsafeUnwrap().userId).toBe(user.id)

    const found = await getUserById(user.id, db)
    if (found.isErr()) throw found.error
    expect(found.value.emailVerifiedAt).not.toBeNull()

    const replay = await consumeEmailVerificationToken({ token }, db)
    expect(replay._unsafeUnwrapErr()).toBe('TOKEN_INVALID')
  })

  test('rejects unknown and expired tokens', async () => {
    const unknown = await consumeEmailVerificationToken({ token: 'f'.repeat(64) }, db)
    expect(unknown._unsafeUnwrapErr()).toBe('TOKEN_INVALID')

    const user = await register('expired@example.com')
    const { token } = await createEmailVerificationToken(user.id, db)
    await db
      .update(schema.emailVerificationTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.emailVerificationTokens.userId, user.id))
    const expired = await consumeEmailVerificationToken({ token }, db)
    expect(expired._unsafeUnwrapErr()).toBe('TOKEN_EXPIRED')
  })

  test('concurrent consumption lets exactly one request win (no double spend)', async () => {
    const user = await register('race@example.com')
    const { token } = await createEmailVerificationToken(user.id, db)

    const [winner, loser] = await Promise.all([
      consumeEmailVerificationToken({ token }, db),
      consumeEmailVerificationToken({ token }, db),
    ])

    expect(winner.isOk()).toBe(true)
    expect(loser._unsafeUnwrapErr()).toBe('TOKEN_INVALID')
    expect(winner._unsafeUnwrap().userId).toBe(user.id)
  })
})

describe('password reset and change', () => {
  test('reset token changes the password and is single-use', async () => {
    await register('reset@example.com')
    const created = await createPasswordResetToken('reset@example.com', db)
    expect(created).not.toBeNull()

    const first = await consumePasswordResetToken(
      { token: created!.token, password: 'new-password-2' },
      db,
    )
    expect(first.isOk()).toBe(true)

    expect(
      (await loginUser({ email: 'reset@example.com', password: 'secret123' }, db)).isErr(),
    ).toBe(true)
    expect(
      (await loginUser({ email: 'reset@example.com', password: 'new-password-2' }, db)).isOk(),
    ).toBe(true)

    const replay = await consumePasswordResetToken(
      { token: created!.token, password: 'another-pass-3' },
      db,
    )
    expect(replay._unsafeUnwrapErr()).toBe('TOKEN_INVALID')
  })

  test('reset token is not created for unknown email', async () => {
    expect(await createPasswordResetToken('ghost@example.com', db)).toBeNull()
  })

  test('concurrent reset consumes the token exactly once', async () => {
    await register('race-reset@example.com')
    const created = await createPasswordResetToken('race-reset@example.com', db)
    if (!created) throw new Error('expected token')

    const attempts = await Promise.all([
      consumePasswordResetToken({ token: created.token, password: 'password-one-1' }, db),
      consumePasswordResetToken({ token: created.token, password: 'password-two-2' }, db),
    ])

    expect(attempts.filter((r) => r.isOk())).toHaveLength(1)
    expect(attempts.filter((r) => r.isErr())).toHaveLength(1)
    for (const attempt of attempts) {
      if (attempt.isErr()) expect(attempt.error).toBe('TOKEN_INVALID')
    }

    const [row] = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.tokenHash, created.token))
    expect(row?.usedAt).not.toBeNull()
  })

  test('change password verifies the current password', async () => {
    const user = await register('change@example.com')
    const wrong = await changePassword(
      user.id,
      { currentPassword: 'wrong', newPassword: 'new-password-2' },
      db,
    )
    expect(wrong._unsafeUnwrapErr()).toBe('LOGIN_FAILED')

    const changed = await changePassword(
      user.id,
      { currentPassword: 'secret123', newPassword: 'new-password-2' },
      db,
    )
    expect(changed.isOk()).toBe(true)
    expect(
      (await loginUser({ email: 'change@example.com', password: 'new-password-2' }, db)).isOk(),
    ).toBe(true)
  })
})

const PHONE_SECRET = 'phone-code-test-secret'

describe('phone login codes', () => {
  const phone = '+8613800000003'

  test('issues, verifies and consumes a code', async () => {
    const requested = await requestPhoneLoginCode(phone, PHONE_SECRET, db)
    if (requested.isErr()) throw requested.error
    expect(requested.value.code).toMatch(/^\d{6}$/)

    const verified = await verifyPhoneLoginCode(phone, requested.value.code, PHONE_SECRET, db)
    expect(verified.isOk()).toBe(true)

    const replay = await verifyPhoneLoginCode(phone, requested.value.code, PHONE_SECRET, db)
    expect(replay.isErr()).toBe(true)
  })

  test('blocks immediate resend and locks after too many attempts', async () => {
    await requestPhoneLoginCode(phone, PHONE_SECRET, db)
    const again = await requestPhoneLoginCode(phone, PHONE_SECRET, db)
    expect(again.isErr()).toBe(true)
    if (!again.isErr() || !(again.error instanceof CodeRequestedTooSoonError)) {
      throw new Error('expected CodeRequestedTooSoonError')
    }
    expect(again.error.retryAfterSeconds).toBeGreaterThan(0)
    expect(again.error.retryAfterSeconds).toBeLessThanOrEqual(60)

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await verifyPhoneLoginCode(phone, '000000', PHONE_SECRET, db)
      expect(result.isErr() && result.error).toBe('CODE_INVALID')
    }
    const locked = await verifyPhoneLoginCode(phone, '000000', PHONE_SECRET, db)
    expect(locked.isErr() && locked.error).toBe('CODE_ATTEMPTS_EXCEEDED')
  })
})

describe('phone binding', () => {
  const phone = '+8613800000004'

  test('binds and unbinds a phone for an email account', async () => {
    const user = await register('phone-bind@example.com')
    const bound = await bindPhone(user.id, phone, db)
    if (bound.isErr()) throw bound.error
    expect(bound.value.phone).toBe(phone)
    expect(bound.value.phoneVerifiedAt).not.toBeNull()

    const found = await findUserByPhone(phone, db)
    expect(found?.id).toBe(user.id)

    const unbound = await unbindPhone(user.id, db)
    expect(unbound.isOk()).toBe(true)
    expect(await findUserByPhone(phone, db)).toBeNull()
  })

  test('rejects a phone already used by another user', async () => {
    const first = await register('phone-first@example.com')
    const second = await register('phone-second@example.com')
    const bound = await bindPhone(first.id, phone, db)
    if (bound.isErr()) throw bound.error

    const conflict = await bindPhone(second.id, phone, db)
    expect(conflict.isErr() && conflict.error).toBe('PHONE_ALREADY_IN_USE')
  })

  test('prevents unbinding the only login method', async () => {
    const user = await createPhoneUser(phone, db)
    if (!user) throw new Error('expected phone user')
    const result = await unbindPhone(user.id, db)
    expect(result.isErr() && result.error).toBe('CANNOT_UNBIND_ONLY_LOGIN')
  })
})

describe('pruneExpiredUserTokens', () => {
  const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
  const recentDate = new Date(Date.now() + 24 * 60 * 60 * 1000)

  test('deletes expired tokens and codes, keeps unexpired rows', async () => {
    const user = await register()

    await db.insert(schema.emailVerificationTokens).values([
      { userId: user.id, tokenHash: 'old-email', expiresAt: oldDate },
      { userId: user.id, tokenHash: 'new-email', expiresAt: recentDate },
    ])
    await db.insert(schema.passwordResetTokens).values([
      { userId: user.id, tokenHash: 'old-reset', expiresAt: oldDate },
      { userId: user.id, tokenHash: 'new-reset', expiresAt: recentDate },
    ])
    await db.insert(schema.phoneLoginCodes).values([
      { phone: '+8613800000001', codeHash: 'old-code', expiresAt: oldDate },
      { phone: '+8613800000002', codeHash: 'new-code', expiresAt: recentDate },
    ])

    const result = await pruneExpiredUserTokens(db, cutoff)
    expect(result).toEqual({
      emailVerificationTokens: 1,
      passwordResetTokens: 1,
      phoneLoginCodes: 1,
    })

    expect(await db.select().from(schema.emailVerificationTokens)).toHaveLength(1)
    expect(await db.select().from(schema.passwordResetTokens)).toHaveLength(1)
    expect(await db.select().from(schema.phoneLoginCodes)).toHaveLength(1)
  })
})
