import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import * as schema from "@yongstack/db/schema";
import { db } from "../../lib/db";
import { env } from "../../lib/env";

async function saveToStorage(file: File, dir: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const filename = `${dir}/${randomUUID()}.${ext}`;
  await mkdir(`${env.STORE_PATH}/${dir}`, { recursive: true });
  const path = `${env.STORE_PATH}/${filename}`;
  await Bun.write(path, file);
  return filename;
}

export async function processUpload(userId: number, file: File, scene: string) {
  const filename = await saveToStorage(file, scene);
  const url = `${env.UPLOAD_PREFIX}/${filename}`;

  await db.insert(schema.fileRecord).values({
    url,
    uploaderId: userId,
    scene,
    size: file.size,
  });

  return url;
}
