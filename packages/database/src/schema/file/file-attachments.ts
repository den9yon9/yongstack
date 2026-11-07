import { index, integer, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { files } from './files'

// 通用附件关联: 任意领域实体通过 (ownerType, ownerId) 挂载文件。
export const fileAttachments = pgTable(
  'file_attachments',
  {
    fileId: uuid('file_id')
      .references(() => files.id, { onDelete: 'cascade' })
      .notNull(),
    ownerType: varchar('owner_type', { length: 100 }).notNull(),
    ownerId: uuid('owner_id').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.fileId, t.ownerType, t.ownerId] }),
    ownerIdx: index('file_attachments_owner_idx').on(t.ownerType, t.ownerId),
  }),
)
