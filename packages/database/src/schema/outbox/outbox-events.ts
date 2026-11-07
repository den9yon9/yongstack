import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const OUTBOX_EVENT_STATUS = ['pending', 'processing', 'delivered', 'failed'] as const
export type OutboxEventStatus = (typeof OUTBOX_EVENT_STATUS)[number]

export const outboxEventStatus = pgEnum('outbox_event_status', OUTBOX_EVENT_STATUS)

// 通用领域事件 outbox: 业务写入与事件落库同事务, worker 异步投递。
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: varchar('type', { length: 255 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: outboxEventStatus('status').default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    availableAt: timestamp('available_at', { withTimezone: true }).defaultNow().notNull(),
    lastError: text('last_error'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    statusAvailableAtIdx: index('outbox_events_status_available_at_idx').on(
      t.status,
      t.availableAt,
    ),
    createdAtIdx: index('outbox_events_created_at_idx').on(t.createdAt),
  }),
)
