import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { registerAccount, USER_REGISTERED_EVENT } from './service'

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

describe('registerAccount', () => {
  test('creates the user and records a user.registered outbox event in one transaction', async () => {
    const result = await registerAccount(
      { name: 'Alice', email: 'alice@example.com', password: 'password123' },
      db,
      { locale: 'zh-CN' },
    )
    if (result.isErr()) throw result.error

    const [event] = await db.select().from(schema.outboxEvents)
    expect(event.type).toBe(USER_REGISTERED_EVENT)
    expect(event.status).toBe('pending')
    expect(event.payload).toMatchObject({
      userId: result.value.id,
      email: 'alice@example.com',
      name: 'Alice',
      locale: 'zh-CN',
    })
  })

  test('does not record an event when registration fails', async () => {
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
    expect(events).toHaveLength(1)
  })
})
