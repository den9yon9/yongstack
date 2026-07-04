import Elysia from "elysia";
import { isAuthenticated } from "../../lib/guard";
import { processUpload } from "../file/service";
import { productModel } from "./model";
import {
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  updateProduct,
  updateProductCover,
  updateProductStatus,
} from "./service";

export const product = new Elysia({ prefix: "/products" })
  .use(productModel)
  .use(isAuthenticated)
  .get("", ({ query }) => listProducts(query), {
    query: "ProductQueryDTO",
    response: "PaginatedProductResponse",
  })
  .get("/:id", ({ params: { id } }) => getProductById(id), {
    params: "ProductIdParams",
    response: "ProductWithSkusResponse",
  })
  .post("", ({ body }) => createProduct(body), {
    body: "CreateProductDTO",
    response: "ProductWithSkusResponse",
  })
  .put("/:id", ({ params: { id }, body }) => updateProduct(id, body), {
    body: "UpdateProductDTO",
    response: "ProductWithSkusResponse",
    params: "ProductIdParams",
  })
  .patch(
    "/:id/status",
    ({ params: { id }, body }) => updateProductStatus(id, body),
    {
      body: "UpdateProductStatusDTO",
      response: "ProductResponse",
      params: "ProductIdParams",
    },
  )
  .delete(
    "/:id",
    async ({ params: { id }, set }) => {
      await deleteProduct(id);
      set.status = 204;
    },
    {
      params: "ProductIdParams",
    },
  )
  .post(
    "/:id/cover",
    async ({ params: { id }, body, userId }) => {
      const url = await processUpload(userId, body.file, "product");
      return updateProductCover(id, url);
    },
    {
      body: "UploadCoverDTO",
      response: "UploadCoverResponseDTO",
      params: "ProductIdParams",
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
