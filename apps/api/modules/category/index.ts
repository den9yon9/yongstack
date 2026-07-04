import Elysia from "elysia";
import { isAuthenticated } from "../../lib/guard";
import { categoryModel } from "./model";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "./service";

export const category = new Elysia({ prefix: "/categories" })
  .use(categoryModel)
  .use(isAuthenticated)
  .get("", () => listCategories(), {
    response: "CategoriesResponse",
  })
  .post("", ({ body }) => createCategory(body), {
    body: "CreateCategoryDTO",
    response: "CategoryResponse",
  })
  .put("/:id", ({ params: { id }, body }) => updateCategory(id, body), {
    body: "UpdateCategoryDTO",
    response: "CategoryResponse",
    params: "CategoryIdParams",
  })
  .delete(
    "/:id",
    async ({ params: { id }, set }) => {
      await deleteCategory(id);
      set.status = 204;
    },
    {
      params: "CategoryIdParams",
    },
  );
