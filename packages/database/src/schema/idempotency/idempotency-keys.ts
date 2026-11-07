import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { users } from '../user/users'

// 通用幂等键: 同一 (scope, key) 只执行一次, 缓存首次响应状态。
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    scope: varchar('scope', { length: 100 }).notNull(),
    key: varchar('key', { length: 255 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    statusCode: integer('status_code').notNull(),
    responseBody: jsonb('response_body').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.scope, t.key] }),
    expiresIdx: index('idempotency_keys_expires_at_idx').on(t.expiresAt),
  }),
)
