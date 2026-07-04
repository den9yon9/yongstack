import * as schema from "@yongstack/db/schema";
import { and, eq, ilike, sql } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../lib/db";
import { processUpload } from "../file/service";
import type { ProductModel } from "./model";

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

function mapSkus(productId: number, skus: ProductModel["CreateSKUDTO"][]) {
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

function cleanUndefined<T extends Record<string, unknown>>(obj: T) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}

export async function createProduct(
  data: ProductModel["CreateProductDTO"],
  userId?: number,
) {
  const { cover, skus, categoryId, ...productData } = data;

  let coverUrl: string | undefined;
  if (cover && userId) {
    coverUrl = await processUpload(userId, cover, "product");
  }

  const result = await db.transaction(async (tx) => {
    const [product] = await tx
      .insert(schema.product)
      .values({
        ...productData,
        categoryId: categoryId ? Number(categoryId) : null,
        status: productData.status ?? "offline",
        coverUrl,
      })
      .returning();

    let skuRecords: (typeof schema.productSku.$inferSelect)[] = [];
    if (skus && skus.length > 0) {
      skuRecords = await tx
        .insert(schema.productSku)
        .values(mapSkus(product.id, skus).map(cleanUndefined))
        .returning();
    }

    return { ...product, skus: skuRecords };
  });

  return result;
}

export async function updateProduct(
  id: number,
  data: ProductModel["UpdateProductDTO"],
  userId?: number,
) {
  const old = await db.query.product.findFirst({
    where: eq(schema.product.id, id),
  });
  if (!old) throw status(404, "商品不存在");

  const { cover, skus, categoryId, ...productData } = data;

  let coverUrl: string | undefined;
  if (cover && userId) {
    coverUrl = await processUpload(userId, cover, "product");
  }

  const result = await db.transaction(async (tx) => {
    const updateData: Record<string, unknown> = {
      ...productData,
      categoryId: categoryId ? Number(categoryId) : null,
    };
    if (coverUrl !== undefined) updateData.coverUrl = coverUrl;

    const [updated] = await tx
      .update(schema.product)
      .set(updateData)
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
          .values(mapSkus(id, skus).map(cleanUndefined))
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
}

export async function updateProductCover(id: number, url: string) {
  const [updated] = await db
    .update(schema.product)
    .set({ coverUrl: url })
    .where(eq(schema.product.id, id))
    .returning();
  if (!updated) throw status(404, "商品不存在");
  return { url };
}
