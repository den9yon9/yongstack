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
    // 文件访问 URL
    url: varchar("url", { length: 512 }).unique().notNull(),
    // 上传者用户 ID
    uploaderId: integer("uploader_id").notNull(),
    // 上传场景：avatar 头像 / product 商品 / order 订单评价等
    scene: varchar("scene", { length: 50 }).notNull(),
    // 文件大小（单位：字节）
    size: integer("size").notNull(),
    // 引用计数，文件被多少个业务引用，为 0 时可被清理
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
