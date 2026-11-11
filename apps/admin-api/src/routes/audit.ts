import { Type } from '@sinclair/typebox'
import { exportAuditLogs, listAuditLogs } from '@yongstack/audit'
import { AuditLogListQuerySchema } from '@yongstack/audit/model'
import { hasPermission } from '@yongstack/session'
import { ErrorResponse } from '@yongstack/shared'
import { Elysia, status, t } from 'elysia'

import { type AdminPlugins } from '../plugins'

const AuditLogItemSchema = Type.Object({
  id: Type.String(),
  actorId: Type.Union([Type.String(), Type.Null()]),
  action: Type.String(),
  targetType: Type.String(),
  targetId: Type.Union([Type.String(), Type.Null()]),
  diff: Type.Record(Type.String(), Type.Unknown()),
  ip: Type.Union([Type.String(), Type.Null()]),
  userAgent: Type.Union([Type.String(), Type.Null()]),
  requestId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.Unknown(),
})

const AuditLogListResponseSchema = Type.Object({
  items: Type.Array(AuditLogItemSchema),
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
})

export function createAuditRoutes(plugins: AdminPlugins) {
  return new Elysia({ name: 'audit-admin', prefix: '/admin' })
    .use(plugins.localePlugin)
    .use(plugins.dbPlugin)
    .use(plugins.sessionPlugin)
    .get(
      '/audit',
      async ({ query, session, db, i18n }) => {
        if (!hasPermission(session, 'audit:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        return listAuditLogs(query, db)
      },
      {
        isAdmin: true,
        query: AuditLogListQuerySchema,
        response: {
          200: AuditLogListResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Audit'],
          summary: '审计日志',
          description: '分页查询审计日志，支持动作/目标/关键词筛选。\n\n- 需要 audit:read 权限',
        },
      },
    )
    .get(
      '/audit/export',
      async ({ query, session, db, i18n }) => {
        if (!hasPermission(session, 'audit:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const rows = await exportAuditLogs(query, db, query.limit ?? 10_000)
        if (query.format === 'csv') {
          const header = [
            'createdAt',
            'actorId',
            'action',
            'targetType',
            'targetId',
            'ip',
            'requestId',
          ]
          const csv = [header.join(',')]
            .concat(
              rows.map((row) =>
                [
                  row.createdAt.toISOString(),
                  row.actorId ?? '',
                  row.action,
                  row.targetType,
                  row.targetId ?? '',
                  row.ip ?? '',
                  row.requestId ?? '',
                ]
                  .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                  .join(','),
              ),
            )
            .join('\n')
          return new Response(csv, {
            headers: {
              'content-type': 'text/csv; charset=utf-8',
              'content-disposition': `attachment; filename="audit-${Date.now()}.csv"`,
            },
          })
        }
        return { items: rows }
      },
      {
        isAdmin: true,
        query: t.Composite([
          AuditLogListQuerySchema,
          t.Object({
            format: t.Optional(t.Union([t.Literal('json'), t.Literal('csv')])),
            limit: t.Optional(t.Number({ minimum: 1, maximum: 50_000 })),
          }),
        ]),
        detail: {
          tags: ['Admin/Audit'],
          summary: '导出审计日志',
          description:
            '按当前筛选条件导出 JSON/CSV(默认 JSON, 最多 10000 条)。\n\n- 需要 audit:read 权限',
        },
      },
    )
}
