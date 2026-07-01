import * as schema from "@yongstack/db/schema";
import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { db } from "../../lib/db";
import { isAuthenticated } from "../../lib/guard";
import { processUpload } from "../file/service";
import { productModel } from "./model";
import {
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  updateProduct,
  updateProductStatus,
} from "./service";

export const product = new Elysia({ prefix: "/product" })
  .use(productModel)
  .use(isAuthenticated)
  .get("", ({ query }) => listProducts(query), {
    query: "ProductQueryDTO",
    response: "PaginatedProductResponse",
  })
  .get("/:id", ({ params: { id } }) => getProductById(id), {
    params: t.Object({ id: t.Numeric() }),
    response: "ProductWithSkusResponse",
  })
  .post("", ({ body }) => createProduct(body), {
    body: "CreateProductDTO",
    response: "ProductWithSkusResponse",
  })
  .put("/:id", ({ params: { id }, body }) => updateProduct(id, body), {
    body: "UpdateProductDTO",
    response: "ProductWithSkusResponse",
    params: t.Object({ id: t.Numeric() }),
  })
  .patch(
    "/:id/status",
    ({ params: { id }, body }) => updateProductStatus(id, body),
    {
      body: "UpdateProductStatusDTO",
      response: "ProductResponse",
      params: t.Object({ id: t.Numeric() }),
    },
  )
  .delete(
    "/:id",
    async ({ params: { id }, set }) => {
      await deleteProduct(id);
      set.status = 204;
    },
    {
      params: t.Object({ id: t.Numeric() }),
    },
  )
  .post(
    "/:id/cover",
    async ({ params: { id }, body, userId }) => {
      const url = await processUpload(userId, body.file, "product");
      await db
        .update(schema.product)
        .set({ coverUrl: url })
        .where(eq(schema.product.id, id));
      return { url };
    },
    {
      body: "UploadCoverDTO",
      response: "UploadCoverResponseDTO",
      params: t.Object({ id: t.Numeric() }),
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
      response: "UploadCoverResponseDTO",
    },
  );
