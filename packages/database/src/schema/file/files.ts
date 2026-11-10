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

import { users } from '../user/users'

// pending: 预签名已签发、等待客户端直传并确认; ready: 元数据完整、可正常使用
export const FILE_STATUS = ['pending', 'ready'] as const
export type FileStatus = (typeof FILE_STATUS)[number]

export const fileStatus = pgEnum('file_status', FILE_STATUS)

export const files = pgTable(
  'files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    key: varchar('key', { length: 500 }).unique().notNull(),
    url: text('url').notNull(),
    mime: varchar('mime', { length: 100 }).notNull(),
    size: integer('size').notNull(),
    width: integer('width'),
    height: integer('height'),
    purpose: varchar('purpose', { length: 100 }).default('general').notNull(),
    checksum: varchar('checksum', { length: 64 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    status: fileStatus('status').default('ready').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    ownerIdx: index('files_owner_id_idx').on(t.ownerId),
    createdAtIdx: index('files_created_at_idx').on(t.createdAt),
    statusCreatedAtIdx: index('files_status_created_at_idx').on(t.status, t.createdAt),
  }),
)
