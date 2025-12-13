import "dotenv/config";
import { createDb } from "./src/client";

// 确保能读到 .env 里的 DATABASE_URL
const _db = createDb(process.env.DATABASE_URL!);

async function main() {
  // TODO: 填充初始用户
  process.exit(0);
}

main();
