import type { Db } from '@yongstack/database'
import {
  listStaleDeletedFiles,
  listStalePendingFiles,
  permanentlyDeleteFile,
} from '@yongstack/file'
import type { Logger } from '@yongstack/shared'
import type { Storage } from '@yongstack/storage'

import type { WorkerEnv } from './env'
import { type PeriodicTaskHandle, startPeriodicTask } from './periodic'

// 软删文件的存储补偿任务:
// 数据库记录软删超过 min age 后, 删除对象存储并硬删 DB 行(attachments 级联)。
// 对象删除失败(如存储暂不可用)时跳过该文件, 下轮重试; 重复删除对象是幂等的。
export function registerFileCleanupWorker(
  env: WorkerEnv,
  cleanupDb: Db,
  storage: Storage,
  logger: Logger,
): PeriodicTaskHandle {
  const minAgeMs = Number(env.FILE_CLEANUP_MIN_AGE_MS)

  const pendingMaxAgeMs = Number(env.FILE_PENDING_MAX_AGE_MS)

  return startPeriodicTask({
    name: 'file-cleanup',
    intervalMs: Number(env.FILE_CLEANUP_INTERVAL_MS),
    logger,
    run: async () => {
      const rows = await listStaleDeletedFiles(new Date(Date.now() - minAgeMs), cleanupDb)
      let cleaned = 0

      for (const row of rows) {
        const removed = await storage.delete(row.key)
        if (removed.isErr()) {
          logger.warn(
            { err: removed.error, fileId: row.id, key: row.key },
            'file object cleanup failed',
          )
          continue
        }
        await permanentlyDeleteFile(row.id, cleanupDb)
        cleaned += 1
      }
      if (rows.length > 0) {
        logger.info({ total: rows.length, cleaned }, 'file cleanup sweep finished')
      }

      // 预签名后未确认的上传: 对象可能未上传(delete 幂等), 行直接硬删
      const pending = await listStalePendingFiles(new Date(Date.now() - pendingMaxAgeMs), cleanupDb)
      let pendingCleaned = 0
      for (const row of pending) {
        const removed = await storage.delete(row.key)
        if (removed.isErr()) {
          logger.warn(
            { err: removed.error, fileId: row.id, key: row.key },
            'pending upload cleanup failed',
          )
          continue
        }
        await permanentlyDeleteFile(row.id, cleanupDb)
        pendingCleaned += 1
      }
      if (pending.length > 0) {
        logger.info(
          { total: pending.length, cleaned: pendingCleaned },
          'pending upload cleanup sweep finished',
        )
      }
    },
  })
}
