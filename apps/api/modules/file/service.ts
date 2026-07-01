import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import * as schema from "@yongstack/db/schema";
import { db } from "../../lib/db";

async function saveToStorage(file: File, dir: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const filename = `${dir}/${randomUUID()}.${ext}`;
  // TODO: 把store配置为环境变量
  const store = "/tmp";
  await mkdir(`${store}/${dir}`, { recursive: true });
  const path = `${store}/${filename}`;
  await Bun.write(path, file);
  return filename;
}

export async function processUpload(userId: number, file: File, scene: string) {
  const url = await saveToStorage(file, scene);

  await db.insert(schema.fileRecord).values({
    url,
    uploaderId: userId,
    scene,
    size: file.size,
  });

  return url;
}
