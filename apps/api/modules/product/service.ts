import * as schema from "@yongstack/db/schema";
import { and, eq, ilike, sql } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../lib/db";
import { decrementFileRef, incrementFileRef } from "../file/service";
import type { ProductModel, SKUBody } from "./model";

// ─── Product ────────────────────────────────────────────────

export async function listProducts(query: ProductModel["ProductQueryDTO"]) {
  const { page = 1, pageSize = 20, keyword, categoryId, status: s } = query;

  const conditions: ReturnType<typeof eq>[] = [];
  if (s) conditions.push(eq(schema.product.status, s));
  if (categoryId !== undefined)
    conditions.push(eq(schema.product.categoryId, categoryId));
  if (keyword) conditions.push(ilike(schema.product.name, `%${keyword}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, total] = await Promise.all([
    db
      .select()
      .from(schema.product)
      .where(where)
      .orderBy(sql`${schema.product.createdAt} desc`)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.product)
      .where(where)
      .then((r) => Number(r[0].count)),
  ]);

  return {
    items,
    total,
    totalPage: Math.ceil(total / pageSize),
    page,
    pageSize,
  };
}

export async function getProductById(id: number) {
  const product = await db.query.product.findFirst({
    where: eq(schema.product.id, id),
    with: { skus: true },
  });
  if (!product) throw status(404, "商品不存在");
  return product;
}

function mapSkus(productId: number, skus: SKUBody[]) {
  return skus.map((sku) => ({
    productId,
    attrs: sku.attrs as Record<string, string>,
    price: sku.price,
    originalPrice: sku.originalPrice ?? null,
    stock: sku.stock ?? 0,
    sales: sku.sales ?? 0,
    image: sku.image ?? null,
  }));
}

export async function createProduct(data: ProductModel["CreateProductDTO"]) {
  const { skus, ...productData } = data;

  const result = await db.transaction(async (tx) => {
    const [product] = await tx
      .insert(schema.product)
      .values({
        ...productData,
        status: productData.status ?? "offline",
        info: (productData.info ?? {}) as Record<string, unknown>,
      })
      .returning();

    let skuRecords: (typeof schema.productSku.$inferSelect)[] = [];
    if (skus && skus.length > 0) {
      skuRecords = await tx
        .insert(schema.productSku)
        .values(mapSkus(product.id, skus))
        .returning();
    }

    return { ...product, skus: skuRecords };
  });

  if (data.coverUrl) {
    await incrementFileRef([data.coverUrl]);
  }

  return result;
}

export async function updateProduct(
  id: number,
  data: ProductModel["UpdateProductDTO"],
) {
  const old = await db.query.product.findFirst({
    where: eq(schema.product.id, id),
  });
  if (!old) throw status(404, "商品不存在");

  const { skus, ...productData } = data;

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.product)
      .set({
        ...productData,
        info:
          productData.info !== undefined
            ? (productData.info as Record<string, unknown>)
            : undefined,
      })
      .where(eq(schema.product.id, id))
      .returning();
    if (!updated) throw status(404, "商品不存在");

    let skuRecords: (typeof schema.productSku.$inferSelect)[] = [];
    if (skus !== undefined) {
      await tx
        .delete(schema.productSku)
        .where(eq(schema.productSku.productId, id));

      if (skus.length > 0) {
        skuRecords = await tx
          .insert(schema.productSku)
          .values(mapSkus(id, skus))
          .returning();
      }
    } else {
      skuRecords = await tx
        .select()
        .from(schema.productSku)
        .where(eq(schema.productSku.productId, id));
    }

    return { ...updated, skus: skuRecords };
  });

  if (data.coverUrl !== undefined && data.coverUrl !== old.coverUrl) {
    if (data.coverUrl) await incrementFileRef([data.coverUrl]);
    if (old.coverUrl) await decrementFileRef([old.coverUrl]);
  }

  return result;
}

export async function updateProductStatus(
  id: number,
  data: ProductModel["UpdateProductStatusDTO"],
) {
  const [updated] = await db
    .update(schema.product)
    .set({ status: data.status })
    .where(eq(schema.product.id, id))
    .returning();
  if (!updated) throw status(404, "商品不存在");
  return updated;
}

export async function deleteProduct(id: number) {
  const old = await db.query.product.findFirst({
    where: eq(schema.product.id, id),
  });
  if (!old) throw status(404, "商品不存在");

  await db.delete(schema.product).where(eq(schema.product.id, id));

  if (old.coverUrl) {
    await decrementFileRef([old.coverUrl]);
  }

  return { success: true as const };
}

// ─── Category ───────────────────────────────────────────────

type CategoryRow = typeof schema.productCategory.$inferSelect;
type CategoryTreeNode = CategoryRow & { children: CategoryTreeNode[] };

export async function listCategories(): Promise<CategoryTreeNode[]> {
  const all = await db
    .select()
    .from(schema.productCategory)
    .orderBy(
      sql`${schema.productCategory.sortOrder} asc nulls last`,
      sql`${schema.productCategory.id} asc`,
    );

  const map = new Map<number, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  for (const cat of all) {
    map.set(cat.id, { ...cat, children: [] });
  }
  for (const cat of all) {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function createCategory(data: ProductModel["CreateCategoryDTO"]) {
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
  data: ProductModel["UpdateCategoryDTO"],
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

  return { success: true as const };
}
