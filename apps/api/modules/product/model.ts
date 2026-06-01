import { db } from "@yongstack/db/model";
import type { Static } from "elysia";
import Elysia, { t } from "elysia";
import type { InferModelsMap } from "../../lib/InferModel";

export const SKUBodySchema = t.Object({
  attrs: t.Record(t.String(), t.String()),
  price: t.Number({ minimum: 0 }),
  originalPrice: t.Optional(t.Number({ minimum: 0 })),
  stock: t.Optional(t.Number({ default: 0, minimum: 0 })),
  sales: t.Optional(t.Number({ default: 0, minimum: 0 })),
  image: t.Optional(t.String()),
});
export type SKUBody = Static<typeof SKUBodySchema>;

export const productModel = new Elysia().model({
  ProductQueryDTO: t.Object({
    page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
    pageSize: t.Optional(t.Numeric({ default: 20, minimum: 1, maximum: 100 })),
    keyword: t.Optional(t.String()),
    categoryId: t.Optional(t.Numeric()),
    status: t.Optional(t.Union([t.Literal("online"), t.Literal("offline")])),
  }),

  CreateProductDTO: t.Object({
    name: t.String({ minLength: 1, maxLength: 200 }),
    description: t.Optional(t.String()),
    categoryId: t.Optional(t.Number()),
    coverUrl: t.Optional(t.String()),
    status: t.Optional(t.Union([t.Literal("online"), t.Literal("offline")])),
    info: t.Optional(t.Record(t.String(), t.Unknown())),
    skus: t.Optional(t.Array(SKUBodySchema)),
  }),

  UpdateProductDTO: t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
    description: t.Optional(t.String()),
    categoryId: t.Optional(t.Number()),
    coverUrl: t.Optional(t.String()),
    status: t.Optional(t.Union([t.Literal("online"), t.Literal("offline")])),
    info: t.Optional(t.Record(t.String(), t.Unknown())),
    skus: t.Optional(t.Array(SKUBodySchema)),
  }),

  UpdateProductStatusDTO: t.Object({
    status: t.Union([t.Literal("online"), t.Literal("offline")]),
  }),

  PaginatedProductResponse: t.Object({
    items: t.Array(db.select.product),
    total: t.Number(),
    totalPage: t.Number(),
    page: t.Number(),
    pageSize: t.Number(),
  }),

  ProductWithSkusResponse: t.Object({
    ...db.select.product.properties,
    skus: t.Array(db.select.productSku),
  }),

  // ─── Category ─────────────────────────────────────────────

  CreateCategoryDTO: t.Object({
    name: t.String({ minLength: 1, maxLength: 50 }),
    parentId: t.Optional(t.Numeric()),
    sortOrder: t.Optional(t.Numeric({ default: 0 })),
  }),

  UpdateCategoryDTO: t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
    parentId: t.Optional(t.Numeric()),
    sortOrder: t.Optional(t.Numeric()),
  }),
});

export type ProductModel = InferModelsMap<typeof productModel>;
