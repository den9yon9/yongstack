import { Type } from '@sinclair/typebox'
import { OUTBOX_EVENT_STATUS, table } from '@yongstack/database'
import { PaginatedResponse, PaginationQuery, SortQuery } from '@yongstack/shared'

export const OutboxEventResponseSchema = table.select.outboxEvent

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
})
