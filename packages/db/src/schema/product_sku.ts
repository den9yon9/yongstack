import {
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { product } from "./product";

export const productSku = pgTable("product_sku", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => product.id),
  // 硬规格属性键值对，如 {"颜色":"红","尺码":"M"}
  attrs: jsonb("attrs").notNull().$type<Record<string, string>>(),
  // 规格组合文本标识，如 "颜色:红|尺码:M"
  attrsText: varchar("attrs_text", { length: 255 }).notNull(),
  // 售价（单位：分）
  price: integer("price").notNull(),
  // 原价/划线价（单位：分）
  originalPrice: integer("original_price"),
  // 当前库存数量
  stock: integer("stock").notNull().default(0),
  // 已售数量
  sales: integer("sales").notNull().default(0),
  // SKU 专属图片 URL（覆盖商品主图）
  image: varchar("image", { length: 512 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
});
