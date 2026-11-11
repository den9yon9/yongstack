import { MAINTENANCE_QUEUE_NAME } from '@yongstack/queue'

// maintenance 队列: 平台级周期任务(数据保留、未来 cron 任务)。
// 与业务 email 队列分开, 便于单独观察失败/重试, 也避免业务队列阻塞运维任务。
export { MAINTENANCE_QUEUE_NAME }

export const MAINTENANCE_JOB_NAMES = {
  RETENTION_OUTBOX: 'retention.outbox',
  RETENTION_TOKENS: 'retention.tokens',
  RETENTION_AUDIT: 'retention.audit',
  RETENTION_IDEMPOTENCY: 'retention.idempotency',
} as const

export type MaintenanceJobName = (typeof MAINTENANCE_JOB_NAMES)[keyof typeof MAINTENANCE_JOB_NAMES]
