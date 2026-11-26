import { Type } from '@sinclair/typebox'
import { OUTBOX_EVENT_STATUS, table } from '@yongstack/database'
import { PaginatedResponse, PaginationQuery, SortQuery } from '@yongstack/shared'

// 白名单: payload 是投递用的内部事件契约(含验证/重置密码的明文 token),
// 不进入列表响应; 排障需要时走独立的详情端点并脱敏。
export const OutboxEventResponseSchema = Type.Pick(table.select.outboxEvent, [
  'id',
  'type',
  'status',
  'attempts',
  'availableAt',
  'lastError',
  'processedAt',
  'requestId',
  'createdAt',
  'updatedAt',
])

const OutboxStatusSchema = Type.Union(OUTBOX_EVENT_STATUS.map((status) => Type.Literal(status)))

export const OutboxEventListQuerySchema = Type.Composite([
  PaginationQuery,
  SortQuery,
  Type.Object({
    status: Type.Optional(OutboxStatusSchema),
    type: Type.Optional(Type.String({ maxLength: 255 })),
    q: Type.Optional(Type.String({ maxLength: 100 })),
  }),
])

export const OutboxEventListResponseSchema = PaginatedResponse(OutboxEventResponseSchema)

export const OutboxStatsResponseSchema = Type.Object({
  pending: Type.Number(),
  processing: Type.Number(),
  delivered: Type.Number(),
  failed: Type.Number(),
  total: Type.Number(),
  oldestPendingAgeSeconds: Type.Union([Type.Number(), Type.Null()]),
})
