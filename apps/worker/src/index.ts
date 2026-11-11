import { createMetrics, Gauge, type Registry, renderMetrics } from '@yongstack/http'
import { createErrorReporter } from '@yongstack/observability'
import { createLogger } from '@yongstack/shared'

import { createEnv } from './env'
import { registerWorkers } from './registry'

const env = createEnv()
const logger = createLogger(env.LOG_LEVEL)
const errorReporter = createErrorReporter({
  dsn: env.SENTRY_DSN,
  environment: env.SENTRY_ENVIRONMENT,
  release: env.SENTRY_RELEASE,
  logger,
})

logger.info('Worker application starting...')

const registration = await registerWorkers(env, logger)
const { workers, close, queues, ready, outboxStats } = registration

for (const worker of workers) {
  worker.on('failed', (job, err) => {
    errorReporter.captureException(err, {
      queue: worker.name,
      jobId: job?.id,
      jobName: job?.name,
    })
  })
}

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaught exception')
  errorReporter.captureException(err)
})
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled rejection')
  errorReporter.captureException(reason)
})

// 可选健康端点: 容器健康检查与 e2e 就绪探测(未设 HEALTH_PORT 则不起);
// 同端口附带 /metrics(Prometheus 文本), BullMQ 队列 job counts 每次抓取时刷新。
if (env.HEALTH_PORT) {
  const port = Number(env.HEALTH_PORT)
  const metrics: Registry = createMetrics()
  const jobCounts = new Gauge({
    name: 'bullmq_queue_jobs',
    help: 'BullMQ jobs by queue and state',
    labelNames: ['queue', 'state'],
    registers: [metrics],
  })
  const outboxEvents = new Gauge({
    name: 'outbox_events',
    help: 'Outbox events by status',
    labelNames: ['status'],
    registers: [metrics],
  })
  const outboxOldestPendingAge = new Gauge({
    name: 'outbox_oldest_pending_age_seconds',
    help: 'Age in seconds of the oldest pending outbox event',
    registers: [metrics],
  })

  Bun.serve({
    port,
    fetch: async (request) => {
      const url = new URL(request.url)
      if (url.pathname === '/metrics') {
        for (const { name, queue } of queues) {
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
            'paused',
          )
          for (const [state, n] of Object.entries(counts)) {
            jobCounts.set({ queue: name, state }, n ?? 0)
          }
        }
        try {
          const stats = await outboxStats()
          for (const status of ['pending', 'processing', 'delivered', 'failed'] as const) {
            outboxEvents.set({ status }, stats[status])
          }
          outboxOldestPendingAge.set(stats.oldestPendingAgeSeconds ?? 0)
        } catch (err) {
          logger.warn({ err }, 'outbox metrics unavailable')
        }
        return new Response(await renderMetrics(metrics), {
          headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
        })
      }
      if (url.pathname === '/health/live') {
        return new Response('ok')
      }
      if (url.pathname === '/health/ready') {
        const state = await ready()
        const healthy = state.db && state.redis
        return Response.json(
          { status: healthy ? 'ok' : 'degraded', ...state },
          { status: healthy ? 200 : 503 },
        )
      }
      // 兼容旧健康检查: 仍表示进程存活
      return new Response('ok')
    },
  })
  logger.info({ port }, 'worker health/metrics endpoint listening')
}

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down worker...')
  const results = await Promise.allSettled(workers.map((worker) => worker.close()))
  await close()
  await errorReporter.flush()
  const failed = results.filter((result) => result.status === 'rejected')
  if (failed.length > 0) {
    logger.error({ count: failed.length }, 'Errors during worker shutdown')
    process.exit(1)
  }
  process.exit(0)
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
process.on('SIGINT', () => {
  void shutdown('SIGINT')
})
