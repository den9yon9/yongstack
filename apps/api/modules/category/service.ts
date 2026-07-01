import * as schema from "@yongstack/db/schema";
import { eq, sql } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../lib/db";
import type { CategoryModel } from "./model";

export async function listCategories() {
  return db
    .select()
    .from(schema.productCategory)
    .orderBy(
      sql`${schema.productCategory.sortOrder} asc nulls last`,
      sql`${schema.productCategory.id} asc`,
    );
}

export async function createCategory(data: CategoryModel["CreateCategoryDTO"]) {
  const [cat] = await db
    .insert(schema.productCategory)
    .values({
      name: data.name,
      parentId: data.parentId,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  return cat;
}

export async function updateCategory(
  id: number,
  data: CategoryModel["UpdateCategoryDTO"],
) {
  const [updated] = await db
    .update(schema.productCategory)
    .set(data)
    .where(eq(schema.productCategory.id, id))
    .returning();
  if (!updated) throw status(404, "类目不存在");
  return updated;
}

export async function deleteCategory(id: number) {
  const existing = await db.query.productCategory.findFirst({
    where: eq(schema.productCategory.id, id),
  });
  if (!existing) throw status(404, "类目不存在");

  const subCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.productCategory)
    .where(eq(schema.productCategory.parentId, id))
    .then((r) => Number(r[0].count));
  if (subCount > 0) throw status(400, "该类目下有子类目，无法删除");

  const productCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.product)
    .where(eq(schema.product.categoryId, id))
    .then((r) => Number(r[0].count));
  if (productCount > 0) throw status(400, "该类目下有商品，无法删除");

  await db
    .delete(schema.productCategory)
    .where(eq(schema.productCategory.id, id));
}
