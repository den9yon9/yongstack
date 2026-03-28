import "dotenv/config";
import { createDb } from "./client";
import { env } from "./env";

// 确保能读到 .env 里的 DATABASE_URL
const db = createDb(env.DATABASE_URL);

console.log(db);

async function main() {
  // TODO: 填充初始用户
  process.exit(0);
}

main();
