import { err, ok } from '@nestup/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { closeDb, type Db, schema, withTransaction } from './index'
import { prepareTestDb, resetDb } from './testing'

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

async function seedUser(email = 'alice@example.com') {
  const [user] = await db
    .insert(schema.users)
    .values({ name: 'Alice', email, passwordHash: 'not-a-real-hash' })
    .returning()
  return user
}

async function insertUser(tx: Parameters<Parameters<typeof withTransaction>[1]>[0], email: string) {
  await tx.insert(schema.users).values({ name: 'Bob', email, passwordHash: 'not-a-real-hash' })
}

async function userCount(email: string) {
  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email))
  return rows.length
}

describe('withTransaction nesting', () => {
  test('reuses the outer transaction instead of opening a new one', async () => {
    await seedUser()
    let innerClientIsOuterTx = false

    const id = await withTransaction(db, async (tx) => {
      return withTransaction(tx, async (tx2) => {
        innerClientIsOuterTx = tx2 === tx
        await insertUser(tx2, 'bob@example.com')
        return 'done'
      })
    })

    expect(id).toBe('done')
    expect(innerClientIsOuterTx).toBe(true)
    // 外层提交, 内层写入随之可见
    expect(await userCount('bob@example.com')).toBe(1)
  })

  test('inner err propagates: outer transaction rolls back as one unit', async () => {
    await seedUser()

    const result = await withTransaction(db, async (tx) => {
      const inner = await withTransaction(tx, async () => err('INNER_FAILURE' as const))
      if (inner.isErr()) return err(inner.error)
      return ok('unreachable' as const)
    })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBe('INNER_FAILURE')
    // 尽管内层写入发生在同一事务, 外层整体回滚
    expect(await userCount('bob@example.com')).toBe(0)
  })

  test('uncaught inner throw propagates and rolls back the outer transaction', async () => {
    await seedUser()

    let threw = false
    try {
      await withTransaction(db, async (tx) => {
        await withTransaction(tx, async () => {
          await insertUser(tx, 'bob@example.com')
          throw new Error('boom')
        })
        return ok('unreachable' as const)
      })
    } catch {
      threw = true
    }

    expect(threw).toBe(true)
    expect(await userCount('bob@example.com')).toBe(0)
  })
})
