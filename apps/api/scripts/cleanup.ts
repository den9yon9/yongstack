import * as schema from "@yongstack/db/schema";
import { eq, lt } from "drizzle-orm";
import { db } from "../lib/db";

async function collectReferencedUrls(): Promise<Set<string>> {
  const urls = new Set<string>();

  const users = await db
    .select({ url: schema.user.avatarUrl })
    .from(schema.user);
  for (const u of users) if (u.url) urls.add(u.url);

  const products = await db
    .select({ url: schema.product.coverUrl })
    .from(schema.product);
  for (const p of products) if (p.url) urls.add(p.url);

  const skus = await db
    .select({ url: schema.productSku.image })
    .from(schema.productSku);
  for (const s of skus) if (s.url) urls.add(s.url);

  return urls;
}

async function runGC() {
  const referencedUrls = await collectReferencedUrls();
  const deadline = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const orphanFiles = await db
    .select()
    .from(schema.fileRecord)
    .where(lt(schema.fileRecord.createdAt, deadline));

  for (const file of orphanFiles) {
    if (referencedUrls.has(file.url)) continue;

    try {
      // TODO: deletePhysicalFile(file.url)

      await db
        .delete(schema.fileRecord)
        .where(eq(schema.fileRecord.id, file.id));
      console.log(`Cleaned up: ${file.url}`);
    } catch (e) {
      console.error(`Failed to clean up: ${file.url}`, e);
    }
  }
}

runGC();
