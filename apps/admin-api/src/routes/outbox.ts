import { withAudit } from '@yongstack/audit'
import { getOutboxStats, listOutboxEvents, replayOutboxEvent } from '@yongstack/outbox'
import * as OutboxModel from '@yongstack/outbox/model'
import { hasPermission } from '@yongstack/session'
import { assertNever, ErrorResponse, requestMeta } from '@yongstack/shared'
import { Elysia, status, t } from 'elysia'

import { type AdminPlugins } from '../plugins'

export function createOutboxRoutes(plugins: AdminPlugins) {
  const { apiRateLimitPerMinute } = plugins

  return new Elysia({ name: 'outbox-admin', prefix: '/admin' })
    .use(plugins.localePlugin)
    .use(plugins.dbPlugin)
    .use(plugins.sessionPlugin)
    .use(plugins.apiRateLimit)
    .get(
      '/outbox',
      async ({ query, session, db, i18n }) => {
        if (!hasPermission(session, 'outbox:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        return listOutboxEvents(query, db)
      },
      {
        isAdmin: true,
        query: OutboxModel.OutboxEventListQuerySchema,
        response: {
          200: OutboxModel.OutboxEventListResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Outbox'],
          summary: '领域事件列表',
          description:
            '分页查询 outbox 事件，支持状态/类型/关键词筛选。\n\n- 需要 outbox:read 权限',
        },
      },
    )
    .get(
      '/outbox/stats',
      async ({ session, db, i18n }) => {
        if (!hasPermission(session, 'outbox:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        return getOutboxStats(db)
      },
      {
        isAdmin: true,
        response: {
          200: OutboxModel.OutboxStatsResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Outbox'],
          summary: '事件状态统计',
          description:
            '按 pending/processing/delivered/failed 聚合计数。\n\n- 需要 outbox:read 权限',
        },
      },
    )
    .post(
      '/outbox/:id/replay',
      async ({ params, session, db, request, i18n }) => {
        if (!hasPermission(session, 'outbox:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const result = await withAudit(
          db,
          (event: { type: string }) => ({
            actorId: session.userId,
            action: 'admin.outbox.replay',
            targetType: 'outbox_event',
            targetId: params.id,
            diff: { type: event.type },
            ...requestMeta(request, { trustProxy: plugins.trustProxy }),
          }),
          (tx) => replayOutboxEvent(params.id, tx),
        )
        if (result.isErr()) {
          switch (result.error) {
            case 'OUTBOX_EVENT_NOT_FOUND':
              return status(404, {
                error: result.error,
                message: i18n('Outbox event not found'),
              })
            case 'OUTBOX_EVENT_NOT_REPLAYABLE':
              return status(409, {
                error: result.error,
                message: i18n('Outbox event is not replayable'),
              })
            default:
              return assertNever(result.error)
          }
        }
        return result.value
      },
      {
        isAdmin: true,
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        response: {
          200: OutboxModel.OutboxEventResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          409: ErrorResponse,
          429: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Admin/Outbox'],
          summary: '重放失败事件',
          description:
            '仅 failed 事件可重放，复位为 pending 并清空退避。\n\n- 需要 outbox:write 权限',
        },
      },
    )
}
