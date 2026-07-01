import { db } from "@yongstack/db/model";
import Elysia, { t } from "elysia";
import type { InferModelsMap } from "../../lib/InferModel";

export const categoryModel = new Elysia().model({
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

  CategoryResponse: db.select.productCategory,

  CategoriesResponse: t.Array(db.select.productCategory),
});

export type CategoryModel = InferModelsMap<typeof categoryModel>;
