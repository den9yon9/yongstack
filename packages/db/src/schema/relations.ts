import { relations } from "drizzle-orm";
import { afterSale } from "./after_sale";
import { cart } from "./cart";
import { fileRecord } from "./file_record";
import { inventoryLog } from "./inventory_log";
import { order } from "./order";
import { orderItem } from "./order_item";
import { orderLog } from "./order_log";
import { product } from "./product";
import { productCategory } from "./product_category";
import { productSku } from "./product_sku";
import { user } from "./user";
import { userAddress } from "./user_address";

export const userRelations = relations(user, ({ many }) => ({
  addresses: many(userAddress),
  carts: many(cart),
  orders: many(order),
  files: many(fileRecord),
}));

export const userAddressRelations = relations(userAddress, ({ one }) => ({
  user: one(user, {
    fields: [userAddress.userId],
    references: [user.id],
  }),
}));

export const productCategoryRelations = relations(
  productCategory,
  ({ many, one }) => ({
    children: many(productCategory, { relationName: "categoryChildren" }),
    parent: one(productCategory, {
      fields: [productCategory.parentId],
      references: [productCategory.id],
      relationName: "categoryChildren",
    }),
    products: many(product),
  }),
);

export const productRelations = relations(product, ({ one, many }) => ({
  category: one(productCategory, {
    fields: [product.categoryId],
    references: [productCategory.id],
  }),
  skus: many(productSku),
}));

export const productSkuRelations = relations(productSku, ({ one }) => ({
  product: one(product, {
    fields: [productSku.productId],
    references: [product.id],
  }),
}));

export const cartRelations = relations(cart, ({ one }) => ({
  user: one(user, {
    fields: [cart.userId],
    references: [user.id],
  }),
  sku: one(productSku, {
    fields: [cart.skuId],
    references: [productSku.id],
  }),
}));

export const orderRelations = relations(order, ({ one, many }) => ({
  user: one(user, {
    fields: [order.userId],
    references: [user.id],
  }),
  items: many(orderItem),
  logs: many(orderLog),
}));

export const orderItemRelations = relations(orderItem, ({ one }) => ({
  order: one(order, {
    fields: [orderItem.orderId],
    references: [order.id],
  }),
  sku: one(productSku, {
    fields: [orderItem.skuId],
    references: [productSku.id],
  }),
}));

export const orderLogRelations = relations(orderLog, ({ one }) => ({
  order: one(order, {
    fields: [orderLog.orderId],
    references: [order.id],
  }),
}));

export const inventoryLogRelations = relations(inventoryLog, ({ one }) => ({
  sku: one(productSku, {
    fields: [inventoryLog.skuId],
    references: [productSku.id],
  }),
}));

export const afterSaleRelations = relations(afterSale, ({ one }) => ({
  orderItem: one(orderItem, {
    fields: [afterSale.orderItemId],
    references: [orderItem.id],
  }),
}));

export const fileRecordRelations = relations(fileRecord, ({ one }) => ({
  uploader: one(user, {
    fields: [fileRecord.uploaderId],
    references: [user.id],
  }),
}));
