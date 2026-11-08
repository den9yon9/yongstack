import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { createUser } from '@yongstack/testkit'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import {
  getAppName,
  getSetting,
  isEmailVerificationRequired,
  isFeatureEnabled,
  listSettings,
  updateSettings,
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

async function seedUser(): Promise<string> {
  const { user } = await createUser(db, { name: 'Admin', email: 'admin@example.com' })
  return user.id
}

describe('settings', () => {
  test('returns defaults when no rows exist', async () => {
    const items = await listSettings(db)
    expect(items.find((item) => item.key === 'app.name')?.value).toBe('Yongstack')
    expect(items.find((item) => item.key === 'auth.requireEmailVerification')?.value).toBe(false)
    expect(await getAppName(db)).toBe('Yongstack')
    expect(await isEmailVerificationRequired(db)).toBe(false)
  })

  test('updates a setting and increments its version', async () => {
    const updatedBy = await seedUser()
    const first = await updateSettings({ 'app.name': 'Acme' }, db, updatedBy)
    if (first.isErr()) throw first.error
    expect(first.value.find((item) => item.key === 'app.name')?.value).toBe('Acme')
    expect(await getAppName(db)).toBe('Acme')

    const second = await updateSettings({ 'app.name': 'Acme 2' }, db, updatedBy)
    if (second.isErr()) throw second.error
    const item = second.value.find((entry) => entry.key === 'app.name')
    expect(item?.value).toBe('Acme 2')
    expect(item?.version).toBe(2)
  })

  test('rejects unknown keys and invalid values', async () => {
    const updatedBy = await seedUser()
    const unknown = await updateSettings({ 'unknown.key': true }, db, updatedBy)
    expect(unknown._unsafeUnwrapErr()).toMatchObject({
      code: 'SETTING_UNKNOWN',
      key: 'unknown.key',
    })

    const invalid = await updateSettings({ 'upload.maxBytes': -1 }, db, updatedBy)
    expect(invalid._unsafeUnwrapErr()).toMatchObject({
      code: 'SETTING_INVALID',
      key: 'upload.maxBytes',
    })
  })

  test('supports dynamic feature flags', async () => {
    const updatedBy = await seedUser()
    expect(await isFeatureEnabled('beta', db)).toBe(false)
    const result = await updateSettings({ 'feature.beta': true }, db, updatedBy)
    if (result.isErr()) throw result.error
    expect(await isFeatureEnabled('beta', db)).toBe(true)
    expect(await getSetting('upload.maxBytes', db)).toBe(5 * 1024 * 1024)
  })

  test('throws on invalid stored values', async () => {
    await db.insert(schema.settings).values({ key: 'app.name', value: 123 })
    expect(listSettings(db)).rejects.toThrow(/invalid stored setting/)
  })
})
