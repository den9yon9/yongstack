import Elysia, { t } from "elysia";
import { categoryModel } from "./model";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "./service";

export const category = new Elysia({ prefix: "/categories" })
  .use(categoryModel)
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
    params: t.Object({ id: t.Numeric() }),
  })
  .delete(
    "/:id",
    async ({ params: { id }, set }) => {
      await deleteCategory(id);
      set.status = 204;
    },
    {
      params: t.Object({ id: t.Numeric() }),
    },
  );
