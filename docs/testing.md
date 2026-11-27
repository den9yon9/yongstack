# 测试分层与运行方式

> 目标：让“纯决策”跑得又快又稳，让真库测试只负责它擅长的 SQL/事务语义。

## 1. 四层测试

| 层            | 依赖                             | 位置                                                              | 典型内容                                  |
| ------------- | -------------------------------- | ----------------------------------------------------------------- | ----------------------------------------- |
| 纯规则        | 无                               | `*/src/rules.test.ts`、`packages/*/src/*.test.ts`                 | 冷却/过期/限额、解绑条件、schemas、纯函数 |
| 领域/用例集成 | PostgreSQL（部分含 Redis）       | `domains/*/src/service.test.ts`、`usecases/*/src/service.test.ts` | SQL、事务、唯一约束、`SELECT FOR UPDATE`  |
| 路由契约      | PostgreSQL + Redis               | `apps/*-api/src/app.test.ts`                                      | 状态码、响应契约、权限、cookie            |
| e2e           | 全套（PG/Redis/对象存储/浏览器） | `apps/e2e/tests/*.spec.ts`                                        | 上传直传、登录流程、关键页面              |

**不要用 mock DB 替换第二/第三层**：这些测试的价值就是验证真实 SQL 与事务语义。要提速，优先把“决策”抽到第一层（见 `domains/user/src/rules.ts`）。

## 2. 怎么运行

```bash
# 纯规则：不设置 TESTING_* 也能跑
cd domains/user && bun test src/rules.test.ts

# 全部测试：需要本地 postgres + redis（TESTING_* 见 .env.example）
pnpm test

# e2e：还需要对象存储与 Playwright
pnpm e2e
```

## 3. 当前为什么是串行

- 根 `pnpm test` = `turbo test --concurrency=1`；
- 每个包 `bun test --parallel=1`；
- 所有包共享同一个 `TESTING_DATABASE_URL`，`beforeEach` 会 `TRUNCATE` 全部表；并行会互相清数据；
- Redis 测试也用同一个 DB（`TESTING_REDIS_URL`）+ `flushdb`。

这是**刻意选择**，不是能力缺失：当前全量测试在十几秒量级，串行更稳定、日志更可读。

## 4. 什么时候值得并行（触发条件）

满足任一条件再启动：

- 全量测试单轮 > 3 分钟；
- 测试包数量 > 25；
- 单个包的测试 > 60 秒。

届时推荐路径（按包分片，不做 worker 级分片）：

1. 测试库按包派生：`yongstack_test_<package>`（`prepareTestDb` 已支持建库）；
2. 迁移一次到 template DB，其余 `CREATE DATABASE ... TEMPLATE`，避免 17 次迁移；
3. Redis 按包哈希到 DB 1~15，或改成按 key 前缀清理；
4. `turbo test` 并发调到 4，包内仍 `--parallel=1`；
5. 用 `time pnpm test` 记录改前/改后，收益 < 30% 就回退。

## 5. 写新测试时的判断

- 有分支、有时间/计数边界、能纯函数化 → 放第一层；
- 依赖 SQL/事务/约束 → 放第二层，不 mock；
- 验证 HTTP 契约/权限/cookie → 放第三层；
- 跨服务、浏览器行为 → e2e，只覆盖关键路径。

## 6. 相关约定

- 纯规则文件命名 `rules.ts` / `rules.test.ts`，不得 import `@yongstack/database`、`@yongstack/redis`、`elysia`；
- 真库测试必须 `prepareTestDb` + `resetDb`，不要自己建表；
- 测试不通过 `setTimeout` 等待真实时间，时间相关逻辑用固定 `now` 注入。
