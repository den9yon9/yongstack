import {
  createInsertSchema as insert,
  createSelectSchema as select,
} from "drizzle-typebox";
import * as schema from "./index";

export const db = {
  insert: {
    user: insert(schema.user),
    userAddress: insert(schema.userAddress),
    productCategory: insert(schema.productCategory),
    product: insert(schema.product),
    productSku: insert(schema.productSku),
    cart: insert(schema.cart),
    order: insert(schema.order),
    orderItem: insert(schema.orderItem),
    orderLog: insert(schema.orderLog),
    inventoryLog: insert(schema.inventoryLog),
    afterSale: insert(schema.afterSale),
    fileRecord: insert(schema.fileRecord),
  },
  select: {
    user: select(schema.user),
    userAddress: select(schema.userAddress),
    productCategory: select(schema.productCategory),
    product: select(schema.product),
    productSku: select(schema.productSku),
    cart: select(schema.cart),
    order: select(schema.order),
    orderItem: select(schema.orderItem),
    orderLog: select(schema.orderLog),
    inventoryLog: select(schema.inventoryLog),
    afterSale: select(schema.afterSale),
    fileRecord: select(schema.fileRecord),
  },
};
