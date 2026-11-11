import type { Static } from '@sinclair/typebox'
import { type DbClient, schema } from '@yongstack/database'
import { buildOffset, err, getRequestId, likePattern, ok, type Result } from '@yongstack/shared'
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'

import type { OutboxEventMap, OutboxEventName } from './events'
import type { OutboxEventListQuerySchema } from './model'

export { type OutboxEventMap, type OutboxEventName } from './events'

export const OUTBOX_MAX_ATTEMPTS = 5
const STALE_PROCESSING_MS = 5 * 60 * 1000

export interface OutboxEvent {
  id: string
  type: string
  payload: Record<string, unknown>
  attempts: number
  requestId: string | null
}

export type OutboxAdminError = 'OUTBOX_EVENT_NOT_FOUND' | 'OUTBOX_EVENT_NOT_REPLAYABLE'

type OutboxEventRow = typeof schema.outboxEvents.$inferSelect

export interface OutboxStats {
  pending: number
  processing: number
  delivered: number
  failed: number
  total: number
  oldestPendingAgeSeconds: number | null
}

// type/payload 受 OutboxEventMap 约束: 生产侧写错事件名或缺字段会直接编译失败。
// 测试/脚手架之外的临时事件也应先注册进 events.ts。
export async function recordOutboxEvent<K extends OutboxEventName>(
  client: DbClient,
  input: { type: K; payload: OutboxEventMap[K]; requestId?: string | null },
): Promise<void> {
  await client.insert(schema.outboxEvents).values({
    type: input.type,
    payload: input.payload,
    // 默认取当前异步上下文; 无上下文(脚本/测试)时留空
    requestId: input.requestId ?? getRequestId() ?? null,
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
    RETURNING id, type, payload, attempts, request_id
  `)
  return rows.map((row) => ({
    id: String(row.id),
    type: String(row.type),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    attempts: Number(row.attempts),
    requestId: row.request_id == null ? null : String(row.request_id),
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

// 管理端: 分页查询事件, 支持状态/类型/关键词筛选。
export async function listOutboxEvents(
  query: Static<typeof OutboxEventListQuerySchema>,
  client: DbClient,
) {
  const { page, pageSize, status, type, q, sort, order } = query
  const conditions = []
  if (status !== undefined) conditions.push(eq(schema.outboxEvents.status, status))
  if (type !== undefined) conditions.push(eq(schema.outboxEvents.type, type))
  if (q !== undefined && q.trim().length > 0) {
    const pattern = likePattern(q)
    conditions.push(
      or(ilike(schema.outboxEvents.type, pattern), ilike(schema.outboxEvents.lastError, pattern))!,
    )
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined
  const sortColumn =
    sort === 'type'
      ? schema.outboxEvents.type
      : sort === 'availableAt'
        ? schema.outboxEvents.availableAt
        : schema.outboxEvents.createdAt

  const rows = await client
    .select()
    .from(schema.outboxEvents)
    .where(where)
    .orderBy(order === 'asc' ? asc(sortColumn) : desc(sortColumn))
    .limit(pageSize)
    .offset(buildOffset(page, pageSize))
  const [{ total }] = await client.select({ total: count() }).from(schema.outboxEvents).where(where)
  return { items: rows, total: Number(total), page, pageSize }
}

export async function getOutboxEventById(
  id: string,
  client: DbClient,
): Promise<Result<OutboxEventRow, OutboxAdminError>> {
  const [event] = await client
    .select()
    .from(schema.outboxEvents)
    .where(eq(schema.outboxEvents.id, id))
  if (!event) return err('OUTBOX_EVENT_NOT_FOUND')
  return ok(event)
}

// 仅 failed 终态可重放: 复位为 pending 并清空退避/错误, 下一轮轮询重新投递。
export async function replayOutboxEvent(
  id: string,
  client: DbClient,
): Promise<Result<OutboxEventRow, OutboxAdminError>> {
  const [event] = await client
    .select()
    .from(schema.outboxEvents)
    .where(eq(schema.outboxEvents.id, id))
  if (!event) return err('OUTBOX_EVENT_NOT_FOUND')
  if (event.status !== 'failed') return err('OUTBOX_EVENT_NOT_REPLAYABLE')

  const [updated] = await client
    .update(schema.outboxEvents)
    .set({
      status: 'pending',
      attempts: 0,
      availableAt: new Date(),
      lastError: null,
      processedAt: null,
    })
    .where(eq(schema.outboxEvents.id, id))
    .returning()
  return ok(updated)
}

export async function getOutboxStats(client: DbClient): Promise<OutboxStats> {
  const rows = await client
    .select({ status: schema.outboxEvents.status, total: count() })
    .from(schema.outboxEvents)
    .groupBy(schema.outboxEvents.status)

  const stats: OutboxStats = {
    pending: 0,
    processing: 0,
    delivered: 0,
    failed: 0,
    total: 0,
    oldestPendingAgeSeconds: null,
  }
  for (const row of rows) {
    const value = Number(row.total)
    stats[row.status] = value
    stats.total += value
  }

  const [oldestPending] = await client
    .select({ createdAt: schema.outboxEvents.createdAt })
    .from(schema.outboxEvents)
    .where(eq(schema.outboxEvents.status, 'pending'))
    .orderBy(asc(schema.outboxEvents.createdAt))
    .limit(1)
  if (oldestPending) {
    stats.oldestPendingAgeSeconds = Math.max(
      0,
      Math.floor((Date.now() - oldestPending.createdAt.getTime()) / 1000),
    )
  }
  return stats
}

// 批量重放失败事件: 运维在大量失败(如 SMTP 故障恢复)后一次性回补。
export async function replayFailedOutboxEvents(client: DbClient, limit = 100): Promise<number> {
  const rows = await client.execute<{ id: string }>(sql`
    UPDATE outbox_events
    SET status = 'pending', attempts = 0, available_at = now(),
        last_error = NULL, processed_at = NULL, updated_at = now()
    WHERE id IN (
      SELECT id FROM outbox_events
      WHERE status = 'failed'
      ORDER BY created_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `)
  return rows.length
}

const PRUNE_BATCH_SIZE = 1000

async function pruneOutboxByStatus(
  client: DbClient,
  status: 'delivered' | 'failed',
  before: Date,
  batchSize: number,
): Promise<number> {
  let total = 0
  for (;;) {
    const rows = await client.execute<{ id: string }>(sql`
      DELETE FROM outbox_events
      WHERE id IN (
        SELECT id FROM outbox_events
        WHERE status = ${status}
          AND processed_at IS NOT NULL
          AND processed_at < ${before.toISOString()}
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id
    `)
    total += rows.length
    if (rows.length < batchSize) break
  }
  return total
}

// 数据保留: 分期删除已投递/终态失败事件, 避免单条 DELETE 长时间锁表。
// delivered 保留期应覆盖审计追溯需求; failed 保留更久便于排障与重放。
export async function pruneOutboxEvents(
  client: DbClient,
  options: { deliveredBefore: Date | null; failedBefore: Date | null; batchSize?: number },
): Promise<{ delivered: number; failed: number }> {
  const batchSize = options.batchSize ?? PRUNE_BATCH_SIZE
  let delivered = 0
  let failed = 0
  if (options.deliveredBefore !== null) {
    delivered = await pruneOutboxByStatus(client, 'delivered', options.deliveredBefore, batchSize)
  }
  if (options.failedBefore !== null) {
    failed = await pruneOutboxByStatus(client, 'failed', options.failedBefore, batchSize)
  }
  return { delivered, failed }
}
