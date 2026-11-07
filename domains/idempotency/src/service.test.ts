import { closeDb, type Db } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { hashIdempotencyRequest, withIdempotency } from './service'

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

describe('withIdempotency', () => {
  test('executes once and replays the cached result', async () => {
    let calls = 0
    const input = {
      scope: 'test',
      key: 'key-1',
      requestHash: hashIdempotencyRequest({ value: 1 }),
    }
    const handler = async () => {
      calls += 1
      return { statusCode: 201, body: { id: 'x' } }
    }

    const first = await withIdempotency(input, db, handler)
    const second = await withIdempotency(input, db, handler)

    expect(first.isOk()).toBe(true)
    expect(second.isOk()).toBe(true)
    expect(second._unsafeUnwrap()).toEqual({ statusCode: 201, body: { id: 'x' } })
    expect(calls).toBe(1)
  })

  test('rejects the same key with a different request hash', async () => {
    await withIdempotency(
      { scope: 'test', key: 'key-1', requestHash: hashIdempotencyRequest({ value: 1 }) },
      db,
      async () => ({ statusCode: 200, body: {} }),
    )

    const mismatch = await withIdempotency(
      { scope: 'test', key: 'key-1', requestHash: hashIdempotencyRequest({ value: 2 }) },
      db,
      async () => ({ statusCode: 200, body: {} }),
    )
    expect(mismatch._unsafeUnwrapErr()).toBe('IDEMPOTENCY_MISMATCH')
  })

  test('different scopes do not collide', async () => {
    let calls = 0
    const handler = async () => {
      calls += 1
      return { statusCode: 200, body: {} }
    }
    const requestHash = hashIdempotencyRequest({})

    await withIdempotency({ scope: 'a', key: 'k', requestHash }, db, handler)
    await withIdempotency({ scope: 'b', key: 'k', requestHash }, db, handler)
    expect(calls).toBe(2)
  })
})
