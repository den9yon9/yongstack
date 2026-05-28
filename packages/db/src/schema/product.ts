import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { productStatus } from "./enums";
import { productCategory } from "./product_category";

export const product = pgTable("product", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  // 商品描述（富文本或纯文本）
  description: text("description"),
  categoryId: integer("category_id").references(() => productCategory.id),
  coverUrl: varchar("cover_url", { length: 512 }),
  // 商品状态：offline 下架 / online 上架
  status: productStatus("status").notNull().default("offline"),
  // 商品扩展信息（软规格、参数等），JSON 格式
  info: jsonb("info").$type<Record<string, string>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
});
