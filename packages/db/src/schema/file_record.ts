import {
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./user";

export const fileRecord = pgTable("file_record", {
  id: serial("id").primaryKey(),
  url: varchar("url", { length: 512 }).unique().notNull(),
  uploaderId: integer("uploader_id")
    .notNull()
    .references(() => user.id),
  scene: varchar("scene", { length: 50 }).notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
