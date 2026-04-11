// apps/api/modules/file/service.ts
import * as schema from "@yongstack/db/schema";
import { randomUUID } from "crypto";
import { inArray, sql } from "drizzle-orm";
import { mkdir } from "fs/promises";
import { db } from "../../lib/db";
import type { FileModel } from "./model";

// import { SCENE_RULES, type UploadScene } from "./model";

async function saveToStorage(file: File, dir: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const filename = `${dir}/${randomUUID()}.${ext}`;
  const path = `./uploads/${filename}`;

  // 确保目录存在
  await mkdir(`./uploads/${dir}`, { recursive: true });
  await Bun.write(path, file);

  // 建议从环境变量读取域名
  return `https://your-domain.com/uploads/${filename}`;
}

export async function processUpload(
  userId: number,
  file: File,
  scene: FileModel["UploadDTO"]["scene"],
) {
  const url = await saveToStorage(file, scene);

  await db.insert(schema.fileRecord).values({
    url,
    uploaderId: userId,
    scene,
    size: file.size,
    refCount: 0, // 初始引用为 0
  });

  return url;
}

export async function incrementFileRef(urls: string[]) {
  const validUrls = urls.filter((u) => u && u.trim() !== "");
  if (validUrls.length === 0) return;

  await db
    .update(schema.fileRecord)
    .set({ refCount: sql`${schema.fileRecord.refCount} + 1` })
    .where(inArray(schema.fileRecord.url, validUrls));
}

export async function decrementFileRef(urls: string[]) {
  const validUrls = urls.filter((u) => u && u.trim() !== "");
  if (validUrls.length === 0) return;

  await db
    .update(schema.fileRecord)
    .set({
      refCount: sql`CASE WHEN ${schema.fileRecord.refCount} > 0 THEN ${schema.fileRecord.refCount} - 1 ELSE 0 END`,
    })
    .where(inArray(schema.fileRecord.url, validUrls));
}
