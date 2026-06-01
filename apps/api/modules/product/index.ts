import Elysia, { t } from "elysia";
import { isAuthenticated } from "../../lib/guard";
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
      response: t.Object({ success: t.Boolean() }),
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
    response: t.Object({ success: t.Boolean() }),
  });
