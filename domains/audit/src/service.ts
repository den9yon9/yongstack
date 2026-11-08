import type { Static } from '@sinclair/typebox'
import { type DbClient, type DbTransaction, schema, withTransaction } from '@yongstack/database'
import { buildOffset, err, ok, type Result } from '@yongstack/shared'
import { likePattern } from '@yongstack/shared'
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm'

import type { AuditLogListQuerySchema } from './model'

export interface RecordAuditInput {
  actorId?: string | null
  action: string
  targetType: string
  targetId?: string | null
  diff?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
  requestId?: string | null
}

type AuditLog = typeof schema.auditLogs.$inferSelect

// 业务写与审计同事务: fn 收到 tx 执行业务写, 返回 err 时整体回滚(审计也不落)。
// 审计条目可预构造, 或根据业务结果生成(如带上新键/新版本)。
export async function withAudit<T, C>(
  client: DbClient,
  entry: RecordAuditInput | ((result: T) => RecordAuditInput),
  fn: (tx: DbTransaction) => Promise<Result<T, C>>,
): Promise<Result<T, C>> {
  return withTransaction(client, async (tx) => {
    const result = await fn(tx)
    if (result.isErr()) return err(result.error)
    await recordAudit(typeof entry === 'function' ? entry(result.value) : entry, tx)
    return ok(result.value)
  })
}

export async function recordAudit(input: RecordAuditInput, client: DbClient): Promise<AuditLog> {
  const [row] = await client
    .insert(schema.auditLogs)
    .values({
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      diff: input.diff ?? {},
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      requestId: input.requestId ?? null,
    })
    .returning()
  return row
}

export async function listAuditLogs(
  query: Static<typeof AuditLogListQuerySchema>,
  client: DbClient,
) {
  const { page, pageSize, q, action, actorId, targetType, targetId, sort, order } = query
  const conditions = []
  if (action !== undefined) conditions.push(eq(schema.auditLogs.action, action))
  if (actorId !== undefined) conditions.push(eq(schema.auditLogs.actorId, actorId))
  if (targetType !== undefined) conditions.push(eq(schema.auditLogs.targetType, targetType))
  if (targetId !== undefined) conditions.push(eq(schema.auditLogs.targetId, targetId))
  if (q !== undefined && q.trim().length > 0) {
    const pattern = likePattern(q)
    conditions.push(
      or(
        ilike(schema.auditLogs.action, pattern),
        ilike(schema.auditLogs.targetType, pattern),
        ilike(schema.auditLogs.targetId, pattern),
      )!,
    )
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined
  const sortColumn = sort === 'action' ? schema.auditLogs.action : schema.auditLogs.createdAt

  const rows = await client
    .select()
    .from(schema.auditLogs)
    .where(where)
    .orderBy(order === 'asc' ? asc(sortColumn) : desc(sortColumn))
    .limit(pageSize)
    .offset(buildOffset(page, pageSize))
  const [{ total }] = await client.select({ total: count() }).from(schema.auditLogs).where(where)
  return { items: rows, total: Number(total), page, pageSize }
}
