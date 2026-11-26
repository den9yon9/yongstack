import { Type } from '@sinclair/typebox'
import { table } from '@yongstack/database'
import { PaginatedResponse, PaginationQuery, SortQuery } from '@yongstack/shared'

// 白名单: 列表只给事件溯源字段; diff(任意 jsonb)与 userAgent 留给详情视图,
// 避免把"未知形状"放进列表契约。
export const AuditLogResponseSchema = Type.Pick(table.select.auditLog, [
  'id',
  'actorId',
  'action',
  'targetType',
  'targetId',
  'ip',
  'requestId',
  'createdAt',
])

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
