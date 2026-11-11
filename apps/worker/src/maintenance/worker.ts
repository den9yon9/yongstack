import type { Db } from '@yongstack/database'
import { createDispatcher, createWorker, type Worker } from '@yongstack/queue'
import type { Logger } from '@yongstack/shared'

import type { WorkerEnv } from '../env'
import { createMaintenanceHandlers } from './handlers'
import { MAINTENANCE_QUEUE_NAME } from './jobs'

export function registerMaintenanceWorker(env: WorkerEnv, db: Db, logger: Logger): Worker<unknown> {
  return createWorker<unknown>(
    MAINTENANCE_QUEUE_NAME,
    createDispatcher(createMaintenanceHandlers(env, db), logger),
    { redisUrl: env.REDIS_URL, logger, concurrency: 1 },
  )
}
