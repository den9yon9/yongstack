import type { Queue, Worker } from '@yongstack/queue'
import type { Logger } from '@yongstack/shared'

import type { WorkerEnv } from './env'

export interface WorkerRegistration {
  workers: Worker[]
  // 队列名 → 实例: /metrics 端点采集 BullMQ job counts
  queues: { name: string; queue: Queue }[]
  close: () => Promise<void>
}

// 队列消费者在后续业务域落地后于此处注册(见 CONTRIBUTE.md「队列」)。
export function registerWorkers(env: WorkerEnv, logger: Logger): WorkerRegistration {
  logger.info({ env: env.NODE_ENV }, 'worker registry initialized (no queues yet)')
  return {
    workers: [],
    queues: [],
    close: async () => {},
  }
}
