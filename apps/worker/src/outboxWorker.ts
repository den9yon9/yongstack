import { closeDb, createDb } from '@yongstack/database'
import { dispatchOutboxEvent, type SendEmailJobData } from '@yongstack/notifications'
import {
  claimOutboxEvents,
  markDelivered,
  markFailed,
  resetStaleProcessing,
} from '@yongstack/outbox'
import type { Queue } from '@yongstack/queue'
import type { Logger } from '@yongstack/shared'

import type { WorkerEnv } from './env'

export interface OutboxWorkerHandle {
  close: () => Promise<void>
}

export function registerOutboxWorker(
  env: WorkerEnv,
  emailQueue: Queue<SendEmailJobData>,
  logger: Logger,
): OutboxWorkerHandle {
  const db = createDb(env.DATABASE_URL)
  let running = false

  const poll = async () => {
    if (running) return
    running = true
    try {
      const stale = await resetStaleProcessing(db)
      if (stale > 0) logger.warn({ count: stale }, 'reset stale outbox events')

      const events = await claimOutboxEvents(db, Number(env.OUTBOX_BATCH_SIZE))
      for (const event of events) {
        try {
          await dispatchOutboxEvent(event, {
            emailQueue,
            appUrl: env.APP_WEB_URL,
            logger,
          })
          await markDelivered(db, event.id)
        } catch (error) {
          logger.error(
            { err: error, eventId: event.id, type: event.type },
            'outbox dispatch failed',
          )
          await markFailed(db, event, error)
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'outbox poll failed')
    } finally {
      running = false
    }
  }

  const timer = setInterval(() => {
    void poll()
  }, Number(env.OUTBOX_POLL_INTERVAL_MS))

  return {
    close: async () => {
      clearInterval(timer)
      await closeDb(db)
    },
  }
}
