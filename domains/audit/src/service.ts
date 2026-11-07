import type { Static } from '@sinclair/typebox'
import { type DbClient, schema } from '@yongstack/database'
import { buildOffset, likePattern } from '@yongstack/shared'
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
