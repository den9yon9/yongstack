// apps/api/modules/file/service.ts
import * as schema from "@yongstack/db/schema";
import { randomUUID } from "crypto";
import { inArray, sql } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../lib/db";
import { SCENE_RULES, type UploadScene } from "./model";

// 这是一个抽象的存储函数（目前存本地，以后方便换 OSS）
async function saveToStorage(file: File, dir: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const filename = `${dir}/${randomUUID()}.${ext}`;

  // Bun 原生写入文件的 API，极其快速
  const path = `./uploads/${filename}`;
  await Bun.write(path, file);

  // 返回可访问的 URL (假设你通过 nginx 或 Elysia 的 static 插件代理了 /uploads)
  return `https://your-domain.com/uploads/${filename}`;
}

export async function processUpload(
  userId: number,
  file: File,
  scene: UploadScene,
) {
  const rules = SCENE_RULES[scene];

  // 1. 场景特定的安全校验
  if (file.size > rules.maxSize) {
    throw status(
      400,
      `文件太大，当前场景最大允许 ${rules.maxSize / 1024 / 1024}MB`,
    );
  }
  if (!rules.allowedTypes.includes(file.type as any)) {
    throw status(
      400,
      `不支持的文件格式，仅支持: ${rules.allowedTypes.join(", ")}`,
    );
  }

  // 2. 存储文件
  const url = await saveToStorage(file, rules.dir);

  // 3. 数据库留痕 (防白嫖的核心)
  await db.insert(schema.fileRecord).values({
    url,
    uploaderId: userId,
    scene,
    size: file.size,
  });

  return url;
}

/**
 * 增加文件引用计数 (原子操作)
 */
export async function incrementFileRef(urls: string[]) {
  const validUrls = urls.filter((u) => u && u.trim() !== "");
  if (validUrls.length === 0) return;

  await db
    .update(schema.fileRecord)
    .set({
      refCount: sql`${schema.fileRecord.refCount} + 1`,
    })
    .where(inArray(schema.fileRecord.url, validUrls));
}

/**
 * 减少文件引用计数 (原子操作，最小减到 0)
 */
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
