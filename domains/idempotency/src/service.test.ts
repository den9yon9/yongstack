import { closeDb, type Db, schema } from '@yongstack/database'
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

  test('concurrent requests run the handler only once', async () => {
    let calls = 0
    let releaseGate!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve
    })
    const input = {
      scope: 'test',
      key: 'race-key',
      requestHash: hashIdempotencyRequest({ value: 'race' }),
    }
    const handler = async () => {
      calls += 1
      await gate
      return { statusCode: 202, body: {} }
    }

    const first = withIdempotency(input, db, handler)
    // 等第一个请求完成占位(执行中), 再发起第二个
    for (let i = 0; i < 100; i += 1) {
      const [row] = await db.select().from(schema.idempotencyKeys)
      if (row) break
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    const second = await withIdempotency(input, db, handler)

    releaseGate()
    const firstResult = await first

    expect(firstResult.isOk()).toBe(true)
    expect(second._unsafeUnwrapErr()).toBe('IDEMPOTENCY_IN_PROGRESS')
    expect(calls).toBe(1)

    // 稍后重试拿到缓存结果
    const retry = await withIdempotency(input, db, handler)
    expect(retry._unsafeUnwrap()).toEqual({ statusCode: 202, body: {} })
    expect(calls).toBe(1)
  })

  test('handler failure clears the placeholder and allows retry', async () => {
    let calls = 0
    const input = {
      scope: 'test',
      key: 'fail-key',
      requestHash: hashIdempotencyRequest({ value: 'fail' }),
    }

    const flaky = async () => {
      calls += 1
      throw new Error('transient')
    }
    const firstTry = await withIdempotency(input, db, flaky).then(
      (r) => r,
      (e) => ({ thrown: (e as Error).message }),
    )
    if (!('thrown' in firstTry)) throw firstTry
    expect(firstTry.thrown).toBe('transient')
    expect(calls).toBe(1)

    const retry = await withIdempotency(input, db, async () => {
      calls += 1
      return { statusCode: 202, body: {} }
    })
    expect(retry.isOk()).toBe(true)

    const record = await db.select().from(schema.idempotencyKeys)
    expect(record).toHaveLength(1)
    expect(record[0]?.status).toBe('completed')
    expect(calls).toBe(2)
  })

  test('stale in_progress placeholder can be taken over', async () => {
    const input = {
      scope: 'test',
      key: 'stale-key',
      requestHash: hashIdempotencyRequest({ value: 'stale' }),
    }
    // 模拟持有者崩溃后遗留的占位: 直接插入一条超过超时时限的 in_progress 记录
    await db.insert(schema.idempotencyKeys).values({
      scope: input.scope,
      key: input.key,
      requestHash: input.requestHash,
      status: 'in_progress',
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })

    let calls = 0
    const result = await withIdempotency(input, db, async () => {
      calls += 1
      return { statusCode: 202, body: {} }
    })
    expect(result.isOk()).toBe(true)
    expect(calls).toBe(1)

    const [record] = await db.select().from(schema.idempotencyKeys)
    expect(record?.status).toBe('completed')
  })

  test('fresh in_progress placeholder reports in progress without running handler', async () => {
    const input = {
      scope: 'test',
      key: 'fresh-key',
      requestHash: hashIdempotencyRequest({ value: 'fresh' }),
    }
    await db.insert(schema.idempotencyKeys).values({
      scope: input.scope,
      key: input.key,
      requestHash: input.requestHash,
      status: 'in_progress',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })

    let calls = 0
    const result = await withIdempotency(input, db, async () => {
      calls += 1
      return { statusCode: 202, body: {} }
    })
    expect(result._unsafeUnwrapErr()).toBe('IDEMPOTENCY_IN_PROGRESS')
    expect(calls).toBe(0)
  })
})
