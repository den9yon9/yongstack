// packages/db/src/schema/file.ts
import {
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const fileRecord = pgTable(
  "file_record",
  {
    id: serial("id").primaryKey(),
    url: varchar("url", { length: 512 }).unique().notNull(),
    uploaderId: integer("uploader_id").notNull(),
    scene: varchar("scene", { length: 50 }).notNull(),
    size: integer("size").notNull(),

    // 核心：引用计数，默认为 0
    refCount: integer("ref_count").default(0).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("file_ref_count_idx").on(table.refCount),
    index("file_created_at_idx").on(table.createdAt),
  ],
);
