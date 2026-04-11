import * as schema from "@yongstack/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { db } from "../lib/db";

async function runGC() {
  const 宽限时间 = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前

  // 1. 查找所有没被引用且已过宽限期的记录
  const deadFiles = await db.query.fileRecord.findMany({
    where: and(
      eq(schema.fileRecord.refCount, 0), // 引用为 0
      lt(schema.fileRecord.createdAt, 宽限时间), // 超过 24 小时
    ),
  });

  for (const file of deadFiles) {
    try {
      // 2. TODO: 物理删除 (OSS 或 本地磁盘)
      // await deletePhysicalFile(file.url);

      // 3. 物理删除成功后，清理数据库记录
      await db
        .delete(schema.fileRecord)
        .where(eq(schema.fileRecord.id, file.id));

      console.log(`Successfully cleaned up: ${file.url}`);
    } catch (e) {
      console.error(`Failed to delete file: ${file.url}`, e);
    }
  }
}

runGC();
