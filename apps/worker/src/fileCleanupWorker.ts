import type { Db } from '@yongstack/database'
import { listStaleDeletedFiles, permanentlyDeleteFile } from '@yongstack/file'
import type { Logger } from '@yongstack/shared'
import type { Storage } from '@yongstack/storage'

import type { WorkerEnv } from './env'

export interface FileCleanupWorkerHandle {
  close: () => Promise<void>
}

// 软删文件的存储补偿任务:
// 数据库记录软删超过 min age 后, 删除对象存储并硬删 DB 行(attachments 级联)。
// 对象删除失败(如存储暂不可用)时跳过该文件, 下轮重试; 重复删除对象是幂等的。
export function registerFileCleanupWorker(
  env: WorkerEnv,
  db: Db,
  storage: Storage,
  logger: Logger,
): FileCleanupWorkerHandle {
  const minAgeMs = Number(env.FILE_CLEANUP_MIN_AGE_MS)
  let running = false

  const poll = async () => {
    if (running) return
    running = true
    try {
      const rows = await listStaleDeletedFiles(new Date(Date.now() - minAgeMs), db)
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
        await permanentlyDeleteFile(row.id, db)
        cleaned += 1
      }
      if (rows.length > 0) {
        logger.info({ total: rows.length, cleaned }, 'file cleanup sweep finished')
      }
    } catch (error) {
      logger.error({ err: error }, 'file cleanup poll failed')
    } finally {
      running = false
    }
  }

  const timer = setInterval(() => {
    void poll()
  }, Number(env.FILE_CLEANUP_INTERVAL_MS))

  return {
    close: async () => {
      clearInterval(timer)
      await db.$client.end({ timeout: 5 }).catch(() => {})
    },
  }
}
