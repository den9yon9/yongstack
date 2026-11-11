import { type Redis } from '@yongstack/redis'
import type { Logger } from '@yongstack/shared'
import { runWithRequestId } from '@yongstack/shared'
import {
  type ConnectionOptions,
  type Processor,
  Queue,
  type QueueOptions,
  Worker,
  type WorkerOptions,
} from 'bullmq'

// 平台级维护队列: 数据保留/定时任务由 worker 消费, admin-api 只读运维。
export const MAINTENANCE_QUEUE_NAME = 'maintenance'

// bullmq v5 传 ioredis 实例即自动识别为共享连接(close() 不释放, 见 queue-base.js
// `shared: isRedisInstance(opts.connection)`); v4 时代的 useSharedConnection 选项已移除。
// 共享时调用方持有连接实例并负责关闭; worker 的阻塞连接不受影响(bullmq 内部始终 duplicate)。
// 传 redisUrl 时 bullmq 自建连接并自行管理生命周期。
// 指标(AUDIT #7): v5 默认开启 metric 采集(Redis 内 `metrics:completed/failed` 桶), opts.metrics
// 只控制 maxDataPoints 保留长度; 消费侧用 queue.getMetrics('completed') 读取(后续 /metrics 端点)。
export type QueueConnection =
  { connection: Redis; redisUrl?: never } | { connection?: never; redisUrl: string }

function resolveConnection(opts: QueueConnection): ConnectionOptions {
  if (opts.connection !== undefined) return opts.connection
  return { url: opts.redisUrl }
}

export function createQueue<T = unknown>(
  name: string,
  opts: QueueConnection & Partial<QueueOptions>,
) {
  const { connection, redisUrl, ...queueOpts } = opts
  return new Queue<T>(name, {
    connection: resolveConnection(opts),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800, count: 5000 },
    },
    ...queueOpts,
  })
}

export type JobHandler<T = unknown> = (data: T, logger: Logger) => Promise<void> | void

export function createDispatcher<T = unknown>(
  handlers: Record<string, JobHandler<T>>,
  logger: Logger,
): Processor<T> {
  return async (job) => {
    const handler = handlers[job.name]
    if (!handler) {
      throw new Error(`No handler registered for job name "${job.name}"`)
    }
    const requestId = (job.data as { requestId?: string } | null)?.requestId ?? `job-${job.id}`
    await runWithRequestId(requestId, () => handler(job.data, logger))
  }
}

export function createWorker<T = unknown>(
  name: string,
  processor: Processor<T>,
  opts: QueueConnection & Partial<WorkerOptions> & { logger: Logger },
) {
  const { connection, redisUrl, logger, ...workerOpts } = opts
  const worker = new Worker<T>(name, processor, {
    connection: resolveConnection(opts),
    concurrency: 5,
    ...workerOpts,
  })

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, jobName: job?.name, err: err.message }, 'BullMQ job failed')
  })

  worker.on('completed', (job) => {
    const duration = job.finishedOn ? job.finishedOn - job.timestamp : undefined
    logger.info({ jobId: job.id, jobName: job.name, duration }, 'BullMQ job completed')
  })

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'BullMQ job stalled')
  })

  worker.on('error', (err) => {
    logger.error({ err }, 'BullMQ worker error')
  })

  return worker
}

export type { Job, Processor, Queue, Worker } from 'bullmq'

// --- 队列运维(管理端) ---
// 只暴露最小只读/重试能力, 不把 BullMQ 类型泄漏到 app 路由层。

export type QueueJobState =
  'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused' | 'wait' | 'prioritized'

export interface QueueJobSummary {
  id: string | undefined
  name: string
  state: QueueJobState
  attemptsMade: number
  timestamp: number
  processedOn: number | null
  finishedOn: number | null
  failedReason: string | null
}

export interface QueueJobDetail extends QueueJobSummary {
  data: unknown
  opts: Record<string, unknown>
  stacktrace: string[]
  returnvalue: unknown
}

export interface QueueSchedulerSummary {
  key: string
  id: string | null
  name: string
  pattern: string | null
  every: number | null
  next: number | null
  tz: string | null
}

export async function getQueueJobCounts(queue: Queue) {
  return queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused')
}

export async function listQueueJobs(
  queue: Queue,
  state: QueueJobState,
  page: number,
  pageSize: number,
): Promise<QueueJobSummary[]> {
  const start = (page - 1) * pageSize
  const jobs = await queue.getJobs([state], start, start + pageSize - 1, false)
  return jobs.map((job) => ({
    id: job.id,
    name: job.name,
    state,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn ?? null,
    finishedOn: job.finishedOn ?? null,
    failedReason: job.failedReason ?? null,
  }))
}

export async function getQueueJob(queue: Queue, id: string): Promise<QueueJobDetail | null> {
  const job = await queue.getJob(id)
  if (!job) return null
  return {
    id: job.id,
    name: job.name,
    state: (await job.getState()) as QueueJobState,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn ?? null,
    finishedOn: job.finishedOn ?? null,
    failedReason: job.failedReason ?? null,
    data: job.data,
    opts: job.opts as unknown as Record<string, unknown>,
    stacktrace: job.stacktrace ?? [],
    returnvalue: job.returnvalue ?? null,
  }
}

export async function retryQueueJob(queue: Queue, id: string): Promise<boolean> {
  const job = await queue.getJob(id)
  if (!job) return false
  await job.retry()
  return true
}

export async function promoteQueueJob(queue: Queue, id: string): Promise<boolean> {
  const job = await queue.getJob(id)
  if (!job) return false
  await job.promote()
  return true
}

export async function removeQueueJob(queue: Queue, id: string): Promise<boolean> {
  const job = await queue.getJob(id)
  if (!job) return false
  await job.remove()
  return true
}

export async function listQueueSchedulers(queue: Queue): Promise<QueueSchedulerSummary[]> {
  const schedulers = await queue.getJobSchedulers(0, -1, true)
  return schedulers.map((scheduler) => ({
    key: scheduler.key,
    id: scheduler.id ?? null,
    name: scheduler.name,
    pattern: scheduler.pattern ?? null,
    every: scheduler.every ?? null,
    next: scheduler.next ?? null,
    tz: scheduler.tz ?? null,
  }))
}

export async function removeQueueScheduler(queue: Queue, id: string): Promise<void> {
  await queue.removeJobScheduler(id)
}

// 立即执行一次 scheduler 对应的任务(不改变原计划), 便于运维手动触发。
export async function runQueueScheduler(queue: Queue, id: string): Promise<string | null> {
  const scheduler = await queue.getJobScheduler(id)
  if (!scheduler) return null
  const job = await queue.add(scheduler.name, (scheduler.template?.data ?? {}) as never)
  return job.id ?? null
}
