import { type Static, Type as t } from "typebox";
import { Value } from "typebox/value";

// 1. 定义 Schema (风格和 Elysia 路由里的 body 定义一致)
const EnvSchema = t.Object({
  // 核心配置
  DATABASE_URL: t.String({ minLength: 1, error: "缺少 DATABASE_URL" }),
});

// 导出类型，供 TS 提示使用
export type Env = Static<typeof EnvSchema>;

// 2. 校验逻辑
// Bun.env (或 process.env) 包含了所有环境变量
const rawEnv = Bun.env;

// 步骤 A: 转换 (Convert)
// 这一步会把字符串 "8080" 转成数字 8080，把 "true" 转成布尔值 true，并应用 default 值
const converted = Value.Convert(EnvSchema, rawEnv);

// 步骤 B: 检查 (Check)
if (!Value.Check(EnvSchema, converted)) {
  // 获取详细错误信息
  const errors = [...Value.Errors(EnvSchema, converted)];

  console.error("\n🚨 环境变量校验失败:");
  for (const error of errors) {
    console.error(`${error.schemaPath}: ${error.message}`);
  }

  // 校验不通过，直接退出
  process.exit(1);
}

// 3. 导出校验后的对象
// 这里使用了 as Env 是因为 TypeBox 的 Convert 返回值推导有时比较宽泛，显式断言更安全
export const env = converted as Env;
