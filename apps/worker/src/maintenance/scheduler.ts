import type { Queue } from '@yongstack/queue'

import { MAINTENANCE_JOB_NAMES, type MaintenanceJobName } from './jobs'

interface MaintenanceSchedule {
  id: string
  name: MaintenanceJobName
  pattern: string
}

// 单副本场景无需分布式锁; BullMQ scheduler 自身按 id 去重, 未来多副本也只会有一个 job。
// 默认凌晨错峰执行, 避免同时扫多张表。
const MAINTENANCE_SCHEDULES: readonly MaintenanceSchedule[] = [
  { id: 'retention.outbox', name: MAINTENANCE_JOB_NAMES.RETENTION_OUTBOX, pattern: '10 3 * * *' },
  { id: 'retention.tokens', name: MAINTENANCE_JOB_NAMES.RETENTION_TOKENS, pattern: '20 3 * * *' },
  { id: 'retention.audit', name: MAINTENANCE_JOB_NAMES.RETENTION_AUDIT, pattern: '30 3 * * *' },
  {
    id: 'retention.idempotency',
    name: MAINTENANCE_JOB_NAMES.RETENTION_IDEMPOTENCY,
    pattern: '40 3 * * *',
  },
]

// 幂等注册: 每次启动 upsert, 修改 cron 后重启即生效。
export async function registerMaintenanceSchedulers(queue: Queue): Promise<void> {
  for (const schedule of MAINTENANCE_SCHEDULES) {
    await queue.upsertJobScheduler(
      schedule.id,
      { pattern: schedule.pattern },
      { name: schedule.name, data: {} },
    )
  }
}
