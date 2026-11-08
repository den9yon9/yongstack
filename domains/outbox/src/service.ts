import { type DbClient, schema } from '@yongstack/database'
import { eq, sql } from 'drizzle-orm'

import type { OutboxEventMap, OutboxEventName } from './events'

export { type OutboxEventMap, type OutboxEventName } from './events'

export const OUTBOX_MAX_ATTEMPTS = 5
const STALE_PROCESSING_MS = 5 * 60 * 1000

export interface RecordOutboxEventInput {
  type: string
  payload: Record<string, unknown>
}

export interface OutboxEvent {
  id: string
  type: string
  payload: Record<string, unknown>
  attempts: number
}

// type/payload 受 OutboxEventMap 约束: 生产侧写错事件名或缺字段会直接编译失败。
// 测试/脚手架之外的临时事件也应先注册进 events.ts。
export async function recordOutboxEvent<K extends OutboxEventName>(
  client: DbClient,
  input: { type: K; payload: OutboxEventMap[K] },
): Promise<void> {
  await client.insert(schema.outboxEvents).values({
    type: input.type,
    payload: input.payload,
  })
}

// 原子抢占: pending 且到期的事件标记为 processing, 多 worker 用 SKIP LOCKED 并行安全。
export async function claimOutboxEvents(client: DbClient, limit = 20): Promise<OutboxEvent[]> {
  const rows = await client.execute<Record<string, unknown>>(sql`
    UPDATE outbox_events
    SET status = 'processing', updated_at = now()
    WHERE id IN (
      SELECT id FROM outbox_events
      WHERE status = 'pending' AND available_at <= now()
      ORDER BY created_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, payload, attempts
  `)
  return rows.map((row) => ({
    id: String(row.id),
    type: String(row.type),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    attempts: Number(row.attempts),
  }))
}

// 进程崩溃会留下 processing 事件; 超过阈值复位为 pending 重投。
export async function resetStaleProcessing(client: DbClient): Promise<number> {
  const staleSeconds = Math.floor(STALE_PROCESSING_MS / 1000)
  const rows = await client.execute<Record<string, unknown>>(sql`
    UPDATE outbox_events
    SET status = 'pending', updated_at = now()
    WHERE status = 'processing'
      AND updated_at < now() - (${staleSeconds} || ' seconds')::interval
    RETURNING id
  `)
  return rows.length
}

export async function markDelivered(client: DbClient, id: string): Promise<void> {
  await client
    .update(schema.outboxEvents)
    .set({ status: 'delivered', processedAt: new Date(), lastError: null })
    .where(eq(schema.outboxEvents.id, id))
}

export async function markFailed(
  client: DbClient,
  event: OutboxEvent,
  error: unknown,
): Promise<void> {
  const attempts = event.attempts + 1
  const failed = attempts >= OUTBOX_MAX_ATTEMPTS
  const delayMs = Math.min(2 ** attempts * 1000, 60_000)
  await client
    .update(schema.outboxEvents)
    .set({
      status: failed ? 'failed' : 'pending',
      attempts,
      availableAt: failed ? new Date() : new Date(Date.now() + delayMs),
      lastError: String(error).slice(0, 1000),
      processedAt: failed ? new Date() : null,
    })
    .where(eq(schema.outboxEvents.id, event.id))
}
