import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 100 }).unique().notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeIdx: index('permissions_code_idx').on(t.code),
  }),
)
