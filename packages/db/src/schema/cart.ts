import {
  boolean,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { productSku } from "./product_sku";
import { user } from "./user";

export const cart = pgTable(
  "cart",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => user.id),
    skuId: integer("sku_id")
      .notNull()
      .references(() => productSku.id),
    quantity: integer("quantity").notNull().default(1),
    // 是否选中，用于结算时批量操作
    selected: boolean("selected").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("cart_user_sku_idx").on(table.userId, table.skuId)],
);
