import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./index";

export type DbClient = ReturnType<typeof createDb>;

export const createDb = (connectionString: string) => {
  // 使用 pg.Pool 可以更好地管理连接池
  const client = new pg.Pool({
    connectionString: connectionString,
  });

  // 返回 drizzle 实例，并注入 schema
  return drizzle(client, {
    schema,
  });
};
