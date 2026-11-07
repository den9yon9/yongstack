import { Type } from '@sinclair/typebox'
import { table } from '@yongstack/database'
import { PaginatedResponse, PaginationQuery, SortQuery } from '@yongstack/shared'

export const AuditLogResponseSchema = table.select.auditLog

export const AuditLogListQuerySchema = Type.Composite([
  PaginationQuery,
  SortQuery,
  Type.Object({
    q: Type.Optional(Type.String({ maxLength: 100 })),
    action: Type.Optional(Type.String({ maxLength: 100 })),
    actorId: Type.Optional(Type.String({ format: 'uuid' })),
    targetType: Type.Optional(Type.String({ maxLength: 100 })),
    targetId: Type.Optional(Type.String({ maxLength: 255 })),
  }),
])

export const AuditLogListResponseSchema = PaginatedResponse(AuditLogResponseSchema)
