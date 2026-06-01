import * as schema from "@yongstack/db/schema";
import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { db } from "../../lib/db";
import { isAuthenticated } from "../../lib/guard";
import { processUpload } from "../file/service";
import { productModel } from "./model";
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  getProductById,
  listCategories,
  listProducts,
  updateCategory,
  updateProduct,
  updateProductStatus,
} from "./service";

export const product = new Elysia({ prefix: "/product" })
  .use(productModel)

  // ─── Categories (public) ──────────────────────────────────
  .get("/categories", () => listCategories(), {
    response: t.Array(t.Any()),
  })
  .post("/categories", ({ body }) => createCategory(body), {
    body: "CreateCategoryDTO",
    response: t.Any(),
  })
  .put(
    "/categories/:id",
    ({ params: { id }, body }) => updateCategory(Number(id), body),
    {
      body: "UpdateCategoryDTO",
      response: t.Any(),
      params: t.Object({ id: t.String() }),
    },
  )
  .delete(
    "/categories/:id",
    ({ params: { id } }) => deleteCategory(Number(id)),
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // ─── Products (authenticated) ─────────────────────────────
  .use(isAuthenticated)
  .get("", ({ query }) => listProducts(query), {
    query: "ProductQueryDTO",
    response: "PaginatedProductResponse",
  })
  .get("/:id", ({ params: { id } }) => getProductById(Number(id)), {
    params: t.Object({ id: t.String() }),
    response: "ProductWithSkusResponse",
  })
  .post("", ({ body }) => createProduct(body), {
    body: "CreateProductDTO",
    response: "ProductWithSkusResponse",
  })
  .put("/:id", ({ params: { id }, body }) => updateProduct(Number(id), body), {
    body: "UpdateProductDTO",
    response: "ProductWithSkusResponse",
    params: t.Object({ id: t.String() }),
  })
  .patch(
    "/:id/status",
    ({ params: { id }, body }) => updateProductStatus(Number(id), body),
    {
      body: "UpdateProductStatusDTO",
      response: t.Any(),
      params: t.Object({ id: t.String() }),
    },
  )
  .delete("/:id", ({ params: { id } }) => deleteProduct(Number(id)), {
    params: t.Object({ id: t.String() }),
  })
  .post(
    "/:id/cover",
    async ({ params: { id }, body, userId }) => {
      const url = await processUpload(userId, body.file, "product");
      await db
        .update(schema.product)
        .set({ coverUrl: url })
        .where(eq(schema.product.id, Number(id)));
      return { url };
    },
    {
      body: "UploadCoverDTO",
      params: t.Object({ id: t.String() }),
    },
  )
  .post(
    "/upload-cover",
    async ({ body, userId }) => {
      const url = await processUpload(userId, body.file, "product");
      return { url };
    },
    {
      body: "UploadCoverDTO",
      response: t.Object({ url: t.String() }),
    },
  );
