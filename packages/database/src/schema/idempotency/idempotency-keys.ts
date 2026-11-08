import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { users } from '../user/users'

export const IDEMPOTENCY_KEY_STATUS = ['in_progress', 'completed'] as const
export type IdempotencyKeyStatus = (typeof IDEMPOTENCY_KEY_STATUS)[number]

export const idempotencyKeyStatus = pgEnum('idempotency_key_status', IDEMPOTENCY_KEY_STATUS)

// 通用幂等键: 同一 (scope, key) 只执行一次, 缓存首次响应状态。
// 占位优先语义: 先以 in_progress 抢占唯一键, 再执行业务副作用,
// 完成后回填 completed + 响应, 避免并发重复执行副作用(如重复发信)。
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    scope: varchar('scope', { length: 100 }).notNull(),
    key: varchar('key', { length: 255 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    status: idempotencyKeyStatus('status').default('in_progress').notNull(),
    statusCode: integer('status_code'),
    responseBody: jsonb('response_body').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.scope, t.key] }),
    expiresIdx: index('idempotency_keys_expires_at_idx').on(t.expiresAt),
  }),
)
