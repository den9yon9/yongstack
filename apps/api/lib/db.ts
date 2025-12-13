// 引用刚才暴露的工厂函数
import { createDb } from "@epinfresh/db/client";
import { env } from "./env";

// 创建并导出单例 db 对象
export const db = createDb(env.DATABASE_URL);
