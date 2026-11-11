import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { hashIdempotencyRequest, pruneExpiredIdempotencyKeys, withIdempotency } from './service'

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

  test('concurrent requests run the handler only once and share the result', async () => {
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

    // 第一个请求卡在 handler 里(事务未提交), 第二个请求的占位插入在
    // 唯一索引上阻塞, 直到第一个事务提交; 等待结束后拿到缓存结果。
    const first = withIdempotency(input, db, async () => {
      calls += 1
      await gate
      return { statusCode: 202, body: { from: 'first' } }
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    // 第二个请求阻塞在唯一索引上, 不能先 await: 必须先放行第一个事务
    const second = withIdempotency(input, db, async () => {
      calls += 1
      return { statusCode: 202, body: { from: 'second' } }
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    releaseGate()
    const firstResult = await first
    const secondResult = await second

    expect(firstResult.isOk()).toBe(true)
    expect(firstResult._unsafeUnwrap()).toEqual({ statusCode: 202, body: { from: 'first' } })
    expect(secondResult.isOk()).toBe(true)
    expect(secondResult._unsafeUnwrap()).toEqual({ statusCode: 202, body: { from: 'first' } })
    expect(calls).toBe(1)
  })

  test('handler failure rolls everything back, retry is a clean re-run', async () => {
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

    // 占位随事务回滚, 没有遗留行, 重试 = 干净地重新执行
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

  test('a pre-existing in_progress placeholder is refused without running the handler', async () => {
    const input = {
      scope: 'test',
      key: 'stuck-key',
      requestHash: hashIdempotencyRequest({ value: 'stuck' }),
    }
    // 单事务语义下占位崩溃即回滚; 出现遗留行意味外部写入, 拒绝执行保护数据。
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

  test('handler writes participate in the caller transaction (atomic side effect)', async () => {
    const input = {
      scope: 'test',
      key: 'tx-key',
      requestHash: hashIdempotencyRequest({ value: 'tx' }),
    }

    // handler 写一条占位外的业务行; 失败时该行必须与占位一起回滚
    const failing = await withIdempotency(input, db, async () => {
      throw new Error('boom')
    }).then(
      (r) => r,
      (e) => ({ thrown: (e as Error).message }),
    )
    if (!('thrown' in failing)) throw failing
    expect(failing.thrown).toBe('boom')

    const rows = await db.select().from(schema.idempotencyKeys)
    expect(rows).toHaveLength(0)
  })
})

describe('pruneExpiredIdempotencyKeys', () => {
  const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
  const recentDate = new Date(Date.now() + 24 * 60 * 60 * 1000)

  test('deletes expired keys only', async () => {
    await db.insert(schema.idempotencyKeys).values([
      {
        scope: 'test',
        key: 'old',
        requestHash: 'hash',
        status: 'completed',
        statusCode: 200,
        responseBody: {},
        expiresAt: oldDate,
      },
      {
        scope: 'test',
        key: 'recent',
        requestHash: 'hash',
        status: 'completed',
        statusCode: 200,
        responseBody: {},
        expiresAt: recentDate,
      },
    ])

    const deleted = await pruneExpiredIdempotencyKeys(db, cutoff)
    expect(deleted).toBe(1)

    const rows = await db.select().from(schema.idempotencyKeys)
    expect(rows).toHaveLength(1)
    expect(rows[0].key).toBe('recent')
  })
})
