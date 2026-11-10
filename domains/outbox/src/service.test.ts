import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import {
  claimOutboxEvents,
  getOutboxStats,
  listOutboxEvents,
  markDelivered,
  markFailed,
  recordOutboxEvent,
  replayOutboxEvent,
  resetStaleProcessing,
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

describe('outbox', () => {
  const payload = { email: 'a@example.com', token: 'tok', locale: 'en' } as const

  test('records, claims and marks an event delivered', async () => {
    await recordOutboxEvent(db, {
      type: 'user.password_reset_requested',
      payload,
    })

    const events = await claimOutboxEvents(db, 10)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'user.password_reset_requested',
      payload,
      attempts: 0,
    })

    await markDelivered(db, events[0].id)
    const [row] = await db.select().from(schema.outboxEvents)
    expect(row.status).toBe('delivered')
    expect(row.processedAt).not.toBeNull()
  })

  test('failed delivery increments attempts and schedules a retry', async () => {
    await recordOutboxEvent(db, { type: 'user.password_reset_requested', payload })
    const [event] = await claimOutboxEvents(db)

    await markFailed(db, event, new Error('boom'))
    const [row] = await db.select().from(schema.outboxEvents)
    expect(row.status).toBe('pending')
    expect(row.attempts).toBe(1)
    expect(row.lastError).toContain('boom')
    expect(row.availableAt.getTime()).toBeGreaterThan(Date.now() - 1000)
  })

  test('marks the event failed after max attempts', async () => {
    const [inserted] = await db
      .insert(schema.outboxEvents)
      .values({
        type: 'user.password_reset_requested',
        payload: {},
        attempts: 4,
        availableAt: new Date(),
      })
      .returning()
    const [event] = await claimOutboxEvents(db)

    await markFailed(db, event, new Error('final failure'))
    const [row] = await db.select().from(schema.outboxEvents)
    expect(row.id).toBe(inserted.id)
    expect(row.status).toBe('failed')
    expect(row.attempts).toBe(5)
    expect(row.processedAt).not.toBeNull()
  })

  test('resets stale processing events back to pending', async () => {
    await db.insert(schema.outboxEvents).values({
      type: 'user.password_reset_requested',
      payload: {},
      status: 'processing',
      updatedAt: new Date(Date.now() - 10 * 60 * 1000),
    })

    const count = await resetStaleProcessing(db)
    expect(count).toBe(1)
    const [row] = await db.select().from(schema.outboxEvents)
    expect(row.status).toBe('pending')
  })
})

describe('outbox admin', () => {
  const payload = { email: 'a@example.com', token: 'tok', locale: 'en' } as const

  test('lists events with status and type filters', async () => {
    await recordOutboxEvent(db, { type: 'user.password_reset_requested', payload })
    const [event] = await claimOutboxEvents(db)
    await markDelivered(db, event.id)
    await recordOutboxEvent(db, {
      type: 'user.registered',
      payload: { userId: 'u', email: 'a@example.com', name: null, locale: 'en' },
    })

    const delivered = await listOutboxEvents({ page: 1, pageSize: 10, status: 'delivered' }, db)
    expect(delivered.total).toBe(1)
    expect(delivered.items[0].type).toBe('user.password_reset_requested')

    const byType = await listOutboxEvents({ page: 1, pageSize: 10, type: 'user.registered' }, db)
    expect(byType.total).toBe(1)
  })

  test('aggregates stats by status', async () => {
    await recordOutboxEvent(db, { type: 'user.password_reset_requested', payload })
    await db.insert(schema.outboxEvents).values({
      type: 'user.registered',
      payload: { userId: 'u' },
      status: 'failed',
      attempts: 5,
    })

    const stats = await getOutboxStats(db)
    expect(stats).toMatchObject({ pending: 1, failed: 1, total: 2 })
  })

  test('replays failed events only', async () => {
    const [failed] = await db
      .insert(schema.outboxEvents)
      .values({
        type: 'user.password_reset_requested',
        payload,
        status: 'failed',
        attempts: 5,
        lastError: 'boom',
      })
      .returning()

    const replayed = await replayOutboxEvent(failed.id, db)
    if (replayed.isErr()) throw replayed.error
    expect(replayed.value).toMatchObject({
      status: 'pending',
      attempts: 0,
      lastError: null,
      processedAt: null,
    })

    const pending = await db
      .insert(schema.outboxEvents)
      .values({ type: 'user.password_reset_requested', payload })
      .returning()
    const rejected = await replayOutboxEvent(pending[0].id, db)
    expect(rejected.isErr()).toBe(true)
    if (rejected.isErr()) expect(rejected.error).toBe('OUTBOX_EVENT_NOT_REPLAYABLE')

    const missing = await replayOutboxEvent('00000000-0000-0000-0000-000000000000', db)
    expect(missing.isErr()).toBe(true)
    if (missing.isErr()) expect(missing.error).toBe('OUTBOX_EVENT_NOT_FOUND')
  })
})
