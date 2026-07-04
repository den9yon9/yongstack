import { db } from "@yongstack/db/model";
import Elysia, { t } from "elysia";
import type { InferModelsMap } from "../../lib/InferModel";

const skuBodySchema = t.Object({
  attrs: t.Record(t.String(), t.String()),
  price: t.Integer({ minimum: 0 }),
  originalPrice: t.Optional(t.Integer({ minimum: 0 })),
  stock: t.Optional(t.Number({ default: 0, minimum: 0 })),
  sales: t.Optional(t.Number({ default: 0, minimum: 0 })),
  image: t.Optional(t.String()),
});

export const productModel = new Elysia().model({
  ProductIdParams: t.Object({ id: t.Numeric() }),
  CreateSKUDTO: skuBodySchema,

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
    categoryId: t.Optional(t.String()),
    cover: t.Optional(
      t.File({
        maxSize: 10 * 1024 * 1024,
        type: ["image/jpeg", "image/png", "image/webp"],
      }),
    ),
    status: t.Optional(t.Union([t.Literal("online"), t.Literal("offline")])),
    skus: t.Optional(t.Array(skuBodySchema)),
  }),

  UpdateProductDTO: t.Object({
    name: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
    description: t.Optional(t.String()),
    categoryId: t.Optional(t.String()),
    cover: t.Optional(
      t.File({
        maxSize: 10 * 1024 * 1024,
        type: ["image/jpeg", "image/png", "image/webp"],
      }),
    ),
    status: t.Optional(t.Union([t.Literal("online"), t.Literal("offline")])),
    skus: t.Optional(t.Array(skuBodySchema)),
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

  ProductResponse: db.select.product,

  UploadCoverResponseDTO: t.Object({
    url: t.String(),
  }),

  UploadCoverDTO: t.Object({
    file: t.File({
      maxSize: 10 * 1024 * 1024,
      type: ["image/jpeg", "image/png", "image/webp"],
    }),
  }),
});

export type ProductModel = InferModelsMap<typeof productModel>;
