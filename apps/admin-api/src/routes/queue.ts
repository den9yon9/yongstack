import { Type } from '@sinclair/typebox'
import { EMAIL_QUEUE_NAME } from '@yongstack/notifications'
import { hasPermission } from '@yongstack/session'
import { ErrorResponse } from '@yongstack/shared'
import { Elysia, status } from 'elysia'

import { type AdminPlugins } from '../plugins'

const QueueCountsResponseSchema = Type.Object({
  items: Type.Array(
    Type.Object({
      name: Type.String(),
      counts: Type.Record(Type.String(), Type.Number()),
    }),
  ),
})

export function createQueueRoutes(plugins: AdminPlugins) {
  return new Elysia({ name: 'queue-admin', prefix: '/admin' })
    .use(plugins.localePlugin)
    .use(plugins.sessionPlugin)
    .get(
      '/queues',
      async ({ session, i18n }) => {
        if (!hasPermission(session, 'outbox:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        try {
          const counts = await plugins.emailQueue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
            'paused',
          )
          return { items: [{ name: EMAIL_QUEUE_NAME, counts }] }
        } catch (err) {
          plugins.logger.error({ err }, 'queue counts unavailable')
          return status(503, {
            error: 'QUEUE_UNAVAILABLE',
            message: i18n('Queue unavailable'),
          })
        }
      },
      {
        isAdmin: true,
        response: {
          200: QueueCountsResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          503: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Outbox'],
          summary: '队列 job 计数',
          description: '只读展示 BullMQ email 队列各状态 job 数量。\n\n- 需要 outbox:read 权限',
        },
      },
    )
}
