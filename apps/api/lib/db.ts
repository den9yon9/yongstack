// 引用刚才暴露的工厂函数
import { createDb } from "@epinfresh/db/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// 创建并导出单例 db 对象
export const db = createDb(process.env.DATABASE_URL);
