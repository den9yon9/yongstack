import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { getUserById, loginUser, registerUser, updateProfile, updateUserLocale } from './service'

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

describe('registerUser', () => {
  test('creates a user with a hashed password', async () => {
    const result = await registerUser(
      { name: 'Alice', email: 'alice@example.com', password: 'secret123' },
      db,
    )
    if (result.isErr()) throw result.error
    expect(result.value.email).toBe('alice@example.com')
    expect(result.value.role).toBe('customer')
    expect(result.value.passwordHash).not.toBe('secret123')
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
    await registerUser({ name: 'Alice', email: 'a@example.com', password: 'secret123' }, db)
    const duplicate = await registerUser(
      { name: 'Bob', email: 'a@example.com', password: 'secret123' },
      db,
    )
    expect(duplicate.isErr()).toBe(true)
    expect(duplicate._unsafeUnwrapErr()).toBe('EMAIL_ALREADY_REGISTERED')
  })
})

describe('loginUser', () => {
  test('returns the user for valid credentials', async () => {
    await registerUser({ name: 'Alice', email: 'a@example.com', password: 'secret123' }, db)
    const result = await loginUser({ email: 'a@example.com', password: 'secret123' }, db)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().email).toBe('a@example.com')
  })

  test('returns LOGIN_FAILED for a wrong password', async () => {
    await registerUser({ name: 'Alice', email: 'a@example.com', password: 'secret123' }, db)
    const result = await loginUser({ email: 'a@example.com', password: 'wrong-pass' }, db)
    expect(result._unsafeUnwrapErr()).toBe('LOGIN_FAILED')
  })

  test('returns LOGIN_FAILED for an unknown email', async () => {
    const result = await loginUser({ email: 'nobody@example.com', password: 'secret123' }, db)
    expect(result._unsafeUnwrapErr()).toBe('LOGIN_FAILED')
  })

  test('returns ACCOUNT_DISABLED for an inactive user', async () => {
    const registered = await registerUser(
      { name: 'Bob', email: 'bob@example.com', password: 'secret123' },
      db,
    )
    if (registered.isErr()) throw registered.error
    // 仅测试直接改状态；生产通过管理端/运维流程变更
    await db
      .update(schema.users)
      .set({ isActive: false })
      .where(eq(schema.users.id, registered.value.id))

    const result = await loginUser({ email: 'bob@example.com', password: 'secret123' }, db)
    expect(result._unsafeUnwrapErr()).toBe('ACCOUNT_DISABLED')
  })
})

describe('profile', () => {
  test('updates name, phone and avatar without touching role', async () => {
    const registered = await registerUser(
      { name: 'Carol', email: 'carol@example.com', password: 'secret123' },
      db,
    )
    if (registered.isErr()) throw registered.error
    const updated = await updateProfile(
      registered.value.id,
      { name: 'Carol 2', phone: '13800000000', avatar: 'https://img.example.com/c.png' },
      db,
    )
    if (updated.isErr()) throw updated.error
    expect(updated.value.name).toBe('Carol 2')
    expect(updated.value.phone).toBe('13800000000')
    expect(updated.value.avatar).toBe('https://img.example.com/c.png')
    expect(updated.value.role).toBe('customer')
  })

  test('returns USER_NOT_FOUND for a missing user', async () => {
    const result = await updateProfile(
      '00000000-0000-4000-8000-000000000000',
      { name: 'Ghost' },
      db,
    )
    expect(result._unsafeUnwrapErr()).toBe('USER_NOT_FOUND')
  })
})

describe('getUserById / updateUserLocale', () => {
  test('finds a user and updates locale', async () => {
    const registered = await registerUser(
      { name: 'Alice', email: 'locale@example.com', password: 'secret123' },
      db,
    )
    if (registered.isErr()) throw registered.error

    await updateUserLocale(registered.value.id, 'zh-CN', db)
    const found = await getUserById(registered.value.id, db)
    if (found.isErr()) throw found.error
    expect(found.value.locale).toBe('zh-CN')
  })

  test('returns USER_NOT_FOUND for a missing user', async () => {
    const result = await getUserById('00000000-0000-4000-8000-000000000000', db)
    expect(result._unsafeUnwrapErr()).toBe('USER_NOT_FOUND')
  })
})
