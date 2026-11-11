import { recordAudit } from '@yongstack/audit'
import {
  getQueueJob,
  getQueueJobCounts,
  listQueueJobs,
  listQueueSchedulers,
  promoteQueueJob,
  removeQueueJob,
  removeQueueScheduler,
  retryQueueJob,
  runQueueScheduler,
} from '@yongstack/queue'
import { hasPermission } from '@yongstack/session'
import { ErrorResponse, PaginationQuery, requestMeta } from '@yongstack/shared'
import { Elysia, status, t } from 'elysia'

import { type AdminPlugins } from '../plugins'

const QueueJobStateSchema = t.Union([
  t.Literal('waiting'),
  t.Literal('active'),
  t.Literal('completed'),
  t.Literal('failed'),
  t.Literal('delayed'),
  t.Literal('paused'),
  t.Literal('wait'),
  t.Literal('prioritized'),
])

const QueueSchedulerSchema = t.Object({
  key: t.String(),
  id: t.Union([t.String(), t.Null()]),
  name: t.String(),
  pattern: t.Union([t.String(), t.Null()]),
  every: t.Union([t.Number(), t.Null()]),
  next: t.Union([t.Number(), t.Null()]),
  tz: t.Union([t.String(), t.Null()]),
})

const QueueOverviewSchema = t.Object({
  items: t.Array(
    t.Object({
      name: t.String(),
      counts: t.Record(t.String(), t.Number()),
      schedulers: t.Array(QueueSchedulerSchema),
    }),
  ),
})

const QueueJobSummarySchema = t.Object({
  id: t.Union([t.String(), t.Null()]),
  name: t.String(),
  state: QueueJobStateSchema,
  attemptsMade: t.Number(),
  timestamp: t.Number(),
  processedOn: t.Union([t.Number(), t.Null()]),
  finishedOn: t.Union([t.Number(), t.Null()]),
  failedReason: t.Union([t.String(), t.Null()]),
})

const QueueJobDetailSchema = t.Composite([
  QueueJobSummarySchema,
  t.Object({
    data: t.Unknown(),
    opts: t.Record(t.String(), t.Unknown()),
    stacktrace: t.Array(t.String()),
    returnvalue: t.Unknown(),
  }),
])

const QueueJobListResponseSchema = t.Object({
  items: t.Array(QueueJobSummarySchema),
  total: t.Number(),
  page: t.Number(),
  pageSize: t.Number(),
})

const QueueJobListQuerySchema = t.Composite([
  PaginationQuery,
  t.Object({ state: QueueJobStateSchema }),
])

const JobActionResponseSchema = t.Object({ ok: t.Boolean() })
const SchedulerRunResponseSchema = t.Object({ jobId: t.Union([t.String(), t.Null()]) })

export function createQueueRoutes(plugins: AdminPlugins) {
  const { apiRateLimitPerMinute } = plugins

  async function audit(
    action: string,
    targetId: string | null,
    queue: string,
    session: { userId: string },
    request: Request,
    db: Parameters<typeof recordAudit>[1],
  ) {
    await recordAudit(
      {
        actorId: session.userId,
        action,
        targetType: 'queue_job',
        targetId,
        diff: { queue },
        ...requestMeta(request, { trustProxy: plugins.trustProxy }),
      },
      db,
    )
  }

  return new Elysia({ name: 'queue-admin', prefix: '/admin' })
    .use(plugins.localePlugin)
    .use(plugins.dbPlugin)
    .use(plugins.sessionPlugin)
    .use(plugins.apiRateLimit)
    .get(
      '/queues',
      async ({ session, i18n }) => {
        if (!hasPermission(session, 'queues:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        try {
          const items = await Promise.all(
            Object.entries(plugins.queues).map(async ([name, queue]) => ({
              name,
              counts: await getQueueJobCounts(queue),
              schedulers: await listQueueSchedulers(queue),
            })),
          )
          return { items }
        } catch (err) {
          plugins.logger.error({ err }, 'queue overview unavailable')
          return status(503, { error: 'QUEUE_UNAVAILABLE', message: i18n('Queue unavailable') })
        }
      },
      {
        isAdmin: true,
        response: {
          200: QueueOverviewSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          503: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Queues'],
          summary: '队列概览',
          description: '列出队列 job 计数与 scheduler。\n\n- 需要 queues:read 权限',
        },
      },
    )
    .get(
      '/queues/:name/jobs',
      async ({ params, query, session, i18n }) => {
        if (!hasPermission(session, 'queues:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const queue = plugins.queues[params.name]
        if (!queue) {
          return status(404, { error: 'QUEUE_NOT_FOUND', message: i18n('Queue not found') })
        }
        try {
          const [items, counts] = await Promise.all([
            listQueueJobs(queue, query.state, query.page, query.pageSize),
            getQueueJobCounts(queue),
          ])
          return {
            items: items.map((job) => ({ ...job, id: job.id ?? null })),
            total: counts[query.state] ?? 0,
            page: query.page,
            pageSize: query.pageSize,
          }
        } catch (err) {
          plugins.logger.error({ err, queue: params.name }, 'queue jobs unavailable')
          return status(503, { error: 'QUEUE_UNAVAILABLE', message: i18n('Queue unavailable') })
        }
      },
      {
        isAdmin: true,
        params: t.Object({ name: t.String({ maxLength: 100 }) }),
        query: QueueJobListQuerySchema,
        response: {
          200: QueueJobListResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          503: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Queues'],
          summary: '队列 job 列表',
          description: '按状态分页查看 job。\n\n- 需要 queues:read 权限',
        },
      },
    )
    .get(
      '/queues/:name/jobs/:id',
      async ({ params, session, i18n }) => {
        if (!hasPermission(session, 'queues:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const queue = plugins.queues[params.name]
        if (!queue) {
          return status(404, { error: 'QUEUE_NOT_FOUND', message: i18n('Queue not found') })
        }
        try {
          const job = await getQueueJob(queue, params.id)
          if (!job) return status(404, { error: 'JOB_NOT_FOUND', message: i18n('Job not found') })
          return { ...job, id: job.id ?? null }
        } catch (err) {
          plugins.logger.error(
            { err, queue: params.name, jobId: params.id },
            'queue job unavailable',
          )
          return status(503, { error: 'QUEUE_UNAVAILABLE', message: i18n('Queue unavailable') })
        }
      },
      {
        isAdmin: true,
        params: t.Object({ name: t.String({ maxLength: 100 }), id: t.String({ maxLength: 100 }) }),
        response: {
          200: QueueJobDetailSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          503: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Queues'],
          summary: '队列 job 详情',
          description: '查看 payload、失败原因与堆栈。\n\n- 需要 queues:read 权限',
        },
      },
    )
    .post(
      '/queues/:name/jobs/:id/retry',
      async ({ params, session, db, request, i18n }) => {
        if (!hasPermission(session, 'queues:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const queue = plugins.queues[params.name]
        if (!queue) {
          return status(404, { error: 'QUEUE_NOT_FOUND', message: i18n('Queue not found') })
        }
        try {
          const ok = await retryQueueJob(queue, params.id)
          if (!ok) return status(404, { error: 'JOB_NOT_FOUND', message: i18n('Job not found') })
          await audit('admin.queue.retry', params.id, params.name, session, request, db)
          return { ok: true }
        } catch (err) {
          plugins.logger.error({ err, queue: params.name, jobId: params.id }, 'queue retry failed')
          return status(503, { error: 'QUEUE_UNAVAILABLE', message: i18n('Queue unavailable') })
        }
      },
      {
        isAdmin: true,
        params: t.Object({ name: t.String({ maxLength: 100 }), id: t.String({ maxLength: 100 }) }),
        response: {
          200: JobActionResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          429: ErrorResponse,
          503: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Admin/Queues'],
          summary: '重试 job',
          description: '重试失败 job。\n\n- 需要 queues:write 权限',
        },
      },
    )
    .post(
      '/queues/:name/jobs/:id/promote',
      async ({ params, session, db, request, i18n }) => {
        if (!hasPermission(session, 'queues:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const queue = plugins.queues[params.name]
        if (!queue) {
          return status(404, { error: 'QUEUE_NOT_FOUND', message: i18n('Queue not found') })
        }
        try {
          const ok = await promoteQueueJob(queue, params.id)
          if (!ok) return status(404, { error: 'JOB_NOT_FOUND', message: i18n('Job not found') })
          await audit('admin.queue.promote', params.id, params.name, session, request, db)
          return { ok: true }
        } catch (err) {
          plugins.logger.error(
            { err, queue: params.name, jobId: params.id },
            'queue promote failed',
          )
          return status(503, { error: 'QUEUE_UNAVAILABLE', message: i18n('Queue unavailable') })
        }
      },
      {
        isAdmin: true,
        params: t.Object({ name: t.String({ maxLength: 100 }), id: t.String({ maxLength: 100 }) }),
        response: {
          200: JobActionResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          429: ErrorResponse,
          503: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Admin/Queues'],
          summary: '提升 job',
          description: '把延迟 job 提前到等待队列。\n\n- 需要 queues:write 权限',
        },
      },
    )
    .delete(
      '/queues/:name/jobs/:id',
      async ({ params, session, db, request, i18n }) => {
        if (!hasPermission(session, 'queues:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const queue = plugins.queues[params.name]
        if (!queue) {
          return status(404, { error: 'QUEUE_NOT_FOUND', message: i18n('Queue not found') })
        }
        try {
          const ok = await removeQueueJob(queue, params.id)
          if (!ok) return status(404, { error: 'JOB_NOT_FOUND', message: i18n('Job not found') })
          await audit('admin.queue.remove', params.id, params.name, session, request, db)
          return status(204)
        } catch (err) {
          plugins.logger.error({ err, queue: params.name, jobId: params.id }, 'queue remove failed')
          return status(503, { error: 'QUEUE_UNAVAILABLE', message: i18n('Queue unavailable') })
        }
      },
      {
        isAdmin: true,
        params: t.Object({ name: t.String({ maxLength: 100 }), id: t.String({ maxLength: 100 }) }),
        response: {
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          429: ErrorResponse,
          503: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Admin/Queues'],
          summary: '删除 job',
          description: '从队列移除 job。\n\n- 需要 queues:write 权限',
        },
      },
    )
    .get(
      '/queues/:name/schedulers',
      async ({ params, session, i18n }) => {
        if (!hasPermission(session, 'queues:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const queue = plugins.queues[params.name]
        if (!queue) {
          return status(404, { error: 'QUEUE_NOT_FOUND', message: i18n('Queue not found') })
        }
        try {
          return { items: await listQueueSchedulers(queue) }
        } catch (err) {
          plugins.logger.error({ err, queue: params.name }, 'queue schedulers unavailable')
          return status(503, { error: 'QUEUE_UNAVAILABLE', message: i18n('Queue unavailable') })
        }
      },
      {
        isAdmin: true,
        params: t.Object({ name: t.String({ maxLength: 100 }) }),
        response: {
          200: t.Object({ items: t.Array(QueueSchedulerSchema) }),
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          503: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Queues'],
          summary: 'scheduler 列表',
          description: '查看周期任务计划。\n\n- 需要 queues:read 权限',
        },
      },
    )
    .post(
      '/queues/:name/schedulers/:id/run',
      async ({ params, session, db, request, i18n }) => {
        if (!hasPermission(session, 'queues:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const queue = plugins.queues[params.name]
        if (!queue) {
          return status(404, { error: 'QUEUE_NOT_FOUND', message: i18n('Queue not found') })
        }
        try {
          const jobId = await runQueueScheduler(queue, params.id)
          if (jobId === null) {
            return status(404, {
              error: 'SCHEDULER_NOT_FOUND',
              message: i18n('Scheduler not found'),
            })
          }
          await audit('admin.queue.scheduler.run', params.id, params.name, session, request, db)
          return { jobId }
        } catch (err) {
          plugins.logger.error(
            { err, queue: params.name, schedulerId: params.id },
            'scheduler run failed',
          )
          return status(503, { error: 'QUEUE_UNAVAILABLE', message: i18n('Queue unavailable') })
        }
      },
      {
        isAdmin: true,
        params: t.Object({ name: t.String({ maxLength: 100 }), id: t.String({ maxLength: 100 }) }),
        response: {
          200: SchedulerRunResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          429: ErrorResponse,
          503: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Admin/Queues'],
          summary: '立即执行 scheduler',
          description:
            '按 scheduler 创建一个立即执行的 job，不改变原计划。\n\n- 需要 queues:write 权限',
        },
      },
    )
    .delete(
      '/queues/:name/schedulers/:id',
      async ({ params, session, db, request, i18n }) => {
        if (!hasPermission(session, 'queues:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const queue = plugins.queues[params.name]
        if (!queue) {
          return status(404, { error: 'QUEUE_NOT_FOUND', message: i18n('Queue not found') })
        }
        try {
          await removeQueueScheduler(queue, params.id)
          await audit('admin.queue.scheduler.remove', params.id, params.name, session, request, db)
          return status(204)
        } catch (err) {
          plugins.logger.error(
            { err, queue: params.name, schedulerId: params.id },
            'scheduler remove failed',
          )
          return status(503, { error: 'QUEUE_UNAVAILABLE', message: i18n('Queue unavailable') })
        }
      },
      {
        isAdmin: true,
        params: t.Object({ name: t.String({ maxLength: 100 }), id: t.String({ maxLength: 100 }) }),
        response: {
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          429: ErrorResponse,
          503: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Admin/Queues'],
          summary: '删除 scheduler',
          description: '停止并移除周期任务计划。\n\n- 需要 queues:write 权限',
        },
      },
    )
}
