import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { users } from '../user/users'

// 通用审计日志: 记录谁在什么时间对什么对象做了什么。
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    targetType: varchar('target_type', { length: 100 }).notNull(),
    targetId: varchar('target_id', { length: 255 }),
    diff: jsonb('diff').$type<Record<string, unknown>>().default({}).notNull(),
    ip: varchar('ip', { length: 64 }),
    userAgent: text('user_agent'),
    requestId: varchar('request_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    actorIdx: index('audit_logs_actor_id_idx').on(t.actorId),
    targetIdx: index('audit_logs_target_idx').on(t.targetType, t.targetId),
    createdAtIdx: index('audit_logs_created_at_idx').on(t.createdAt),
  }),
)
