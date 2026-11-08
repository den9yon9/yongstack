import { type Db } from '@yongstack/database'
import { dispatchOutboxEvent, type EmailJobQueue } from '@yongstack/notifications'
import {
  claimOutboxEvents,
  markDelivered,
  markFailed,
  resetStaleProcessing,
} from '@yongstack/outbox'
import type { Logger } from '@yongstack/shared'

import type { WorkerEnv } from './env'
import { type PeriodicTaskHandle, startPeriodicTask } from './periodic'

export function registerOutboxWorker(
  env: WorkerEnv,
  emailQueue: EmailJobQueue,
  db: Db,
  logger: Logger,
): PeriodicTaskHandle {
  return startPeriodicTask({
    name: 'outbox',
    intervalMs: Number(env.OUTBOX_POLL_INTERVAL_MS),
    logger,
    run: async () => {
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
    },
  })
}
