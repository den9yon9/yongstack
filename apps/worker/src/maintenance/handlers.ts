import { pruneAuditLogs } from '@yongstack/audit'
import type { Db } from '@yongstack/database'
import { pruneExpiredIdempotencyKeys } from '@yongstack/idempotency'
import { pruneOutboxEvents } from '@yongstack/outbox'
import type { Logger } from '@yongstack/shared'
import { pruneExpiredUserTokens } from '@yongstack/user'

import type { WorkerEnv } from '../env'
import { MAINTENANCE_JOB_NAMES } from './jobs'

const DAY_MS = 24 * 60 * 60 * 1000

// 0 或非法值表示关闭对应清理; 只有正数才返回截止时间。
function cutoff(days: number): Date | null {
  if (!Number.isFinite(days) || days <= 0) return null
  return new Date(Date.now() - days * DAY_MS)
}

export function createMaintenanceHandlers(
  env: WorkerEnv,
  db: Db,
): Record<string, (data: unknown, handlerLogger: Logger) => Promise<void>> {
  return {
    [MAINTENANCE_JOB_NAMES.RETENTION_OUTBOX]: async (_data, handlerLogger) => {
      const deliveredBefore = cutoff(Number(env.RETENTION_OUTBOX_DELIVERED_DAYS))
      const failedBefore = cutoff(Number(env.RETENTION_OUTBOX_FAILED_DAYS))
      if (deliveredBefore === null && failedBefore === null) {
        handlerLogger.debug('outbox retention disabled')
        return
      }
      const result = await pruneOutboxEvents(db, { deliveredBefore, failedBefore })
      handlerLogger.info({ ...result }, 'outbox retention sweep finished')
    },
    [MAINTENANCE_JOB_NAMES.RETENTION_TOKENS]: async (_data, handlerLogger) => {
      const before = cutoff(Number(env.RETENTION_TOKEN_DAYS))
      if (before === null) {
        handlerLogger.debug('token retention disabled')
        return
      }
      const result = await pruneExpiredUserTokens(db, before)
      handlerLogger.info({ ...result }, 'token retention sweep finished')
    },
    [MAINTENANCE_JOB_NAMES.RETENTION_AUDIT]: async (_data, handlerLogger) => {
      const before = cutoff(Number(env.RETENTION_AUDIT_DAYS))
      if (before === null) {
        handlerLogger.debug('audit retention disabled')
        return
      }
      const deleted = await pruneAuditLogs(db, before)
      handlerLogger.info({ deleted }, 'audit retention sweep finished')
    },
    [MAINTENANCE_JOB_NAMES.RETENTION_IDEMPOTENCY]: async (_data, handlerLogger) => {
      const before = cutoff(Number(env.RETENTION_IDEMPOTENCY_DAYS))
      if (before === null) {
        handlerLogger.debug('idempotency retention disabled')
        return
      }
      const deleted = await pruneExpiredIdempotencyKeys(db, before)
      handlerLogger.info({ deleted }, 'idempotency retention sweep finished')
    },
  }
}
