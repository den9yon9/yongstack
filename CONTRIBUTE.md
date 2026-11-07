# CONTRIBUTE.md

面向新开发者的上手文档：分层 → 开发模式 → 动手写。所有代码都应遵循下文模式；
如发现文档与代码不一致，以代码为准并修正本文档。

## 技术栈

pnpm + Turborepo Monorepo、Bun 运行时

- Web：ElysiaJS（类型安全、插件化）
- ORM：Drizzle + postgres.js；DB 与 API 契约单一来源（TypeBox / drizzle-typebox）
- 队列：BullMQ（Redis）；会话：Redis 会话 + 签名 Cookie；错误：neverthrow Result
- 工具：ESLint（含 eslint-plugin-boundaries 分层校验）、Prettier、lefthook、commitlint

## 分层架构

目录即分层，依赖方向由 eslint-plugin-boundaries 编译期强制（单向无环）：

```
apps/       presentation   可依赖一切（薄壳：装配 + HTTP 映射，不含业务逻辑）
usecases/*  编排层         可依赖 persistence/shared/domains（跨域用例）
domains/*   entity 域      可依赖 persistence/shared（纯业务逻辑）
packages/   shared / persistence / infrastructure（纯工具、DB、基础设施）
```

- domain 之间禁止互调；只有 usecases 能编排多个 domain
- queue/http/session/redis/storage 全部归 infrastructure，领域层编译期封死
- `eden-client` 提供两端共用的 treaty 类型工具
- 新增/改名 domain 或 usecase 无需改 eslint 配置（pattern 是目录通配）

## 快速上手

```bash
pnpm bootstrap   # 首次：装依赖、生成 .env、起基础设施、建 bucket、迁移
pnpm dev         # 自动迁移 + 全部服务 watch
```

- 需要 Docker；没有 Docker 或使用 R2/COS 时见 [docs/onboarding.md](docs/onboarding.md)
- 只检查环境：`pnpm bootstrap:check`

- 接口文档：http://localhost:3000/docs（app）、http://localhost:3001/docs（admin）
- `pnpm test` 需要本地 postgres + redis；测试库/Redis 配置在 `.env` 的 `TESTING_*`
- 常用命令：`bootstrap` / `bootstrap:check` / `typecheck` / `lint` / `format` / `check` / `build` / `clean` / `test`

## 开发模式

### 1. 新增领域（domains/*）

固定三文件结构，职责严格分离：

| 文件       | 职责                       | 约束                                                                                                   |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| model.ts   | TypeBox schema，从 DB 派生 | 字段约束集中在 packages/database/src/model.ts                                                          |
| service.ts | 纯业务函数                 | 不 import Elysia/session/http；依赖以参数注入（client: DbClient）；失败 `err('CODE')`，成功 `ok(data)` |
| index.ts   | 对外出口，只导出函数与类型 | 不暴露内部实现                                                                                         |

**表访问**（ESLint 强制）：只许读写本域的表（写：`table-ownership`；读：`cross-domain-read`）。
跨域取数经域函数/usecase 编排（行为性校验与展示拼装都在 usecases），apps 层禁止引用任何表。

**错误码约定**：默认错误就是大写字符串 `err('CODE')`（字符串字面量推断不拓宽，零仪式）。
只有需要附带数据时，才把该错误码升级为对象 `err({ code: 'CODE', ...payload })`。
每个域/用例在 service.ts 顶部定义自己的错误联合类型。控制器必须穷举映射（见 §3），
因此**新增错误码 = 编译错误**，强制在任何入口处补映射，杜绝静默漏处理。

**失败的三种表达**（ESLint `invariant-throw/no-bare-throw` 强制，env.ts 豁免）：

- 业务失败 → `return err('CODE')`：进错误契约，调用方穷举处理
- 不该发生的失败（数据不一致/程序 bug）→
  `throw new InvariantViolation(msg, { cause })`（`@yongstack/shared`）：触发回滚、
  落 500，name 可监控告警；与 `assertNever` 同族（编译期/运行时两种"不可能"）
- 环境配置错误 → env.ts 内 fail-fast `throw new Error`（启动即失败）

### 2. 新增用例（usecases/*）

跨域编排放这里，与 domain 同样的三文件结构。需要原子性时用
`withTransaction(client, fn)`（@yongstack/database）包住多个 domain 调用；
回调内 `return err('CODE')` 会自动回滚整个事务（helper 内部转抛 abort 再还原为 err），
DB 异常同理。域/用例内禁止直接调用 `.transaction(`（ESLint 强制）。
幂等需求在事务内写唯一约束表实现（冲突时回滚整个事务，不静默跳过）。

### 3. 新增路由（apps/*/src/routes/）

控制器 = Elysia 实例，职责：HTTP 协议映射 + 校验 + 错误码→状态码。
每个路由文件导出工厂 `createXxxRoutes(plugins)`，接收插件实例按需 `.use()`：

```ts
export function createOrderRoutes(plugins: AppPlugins) {
  return new Elysia({ name: 'order-app' })
    .use(plugins.dbPlugin)
    .use(plugins.sessionPlugin)
    .post(
      '/orders',
      async ({ body, session, db }) => {
        const result = await checkout({ ...body, userId: session.userId }, db)
        return result.match(
          (order) => status(201, order),
          (e) => {
            switch (e) {
              case 'SKU_NOT_FOUND':
                return status(404, { error: e, message: 'SKU not found' })
              case 'INSUFFICIENT_STOCK':
                return status(409, { error: e, message: 'Insufficient stock' })
              default:
                return assertNever(e)
            }
          },
        )
      },
      {
        isAuth: true,
        body: CreateOrderInputSchema,
        response: { 200: OrderResponseSchema, 404: ErrorResponse },
        detail: { tags: ['Orders'] },
      },
    )
}
```

规范：

- 用 `result.match()` 消费 Result；错误分支 switch 穷举 + `default: assertNever(e)`
- 错误码格式为 SCREAMING_SNAKE（`^[A-Z][A-Z0-9_]*$`），ESLint 强制
  （`error-code/screaming-snake`，作用于 domains/usecases）
- 响应 schema 必须显式声明（`response: {...}`）；Elysia normalize 自动剥离未声明字段，
  敏感字段只需在 schema 中 omit，service 层不手工剔除
- 认证用 `isAuth` / `isAdmin` macro（packages/session 提供）
- 前置守卫（不消费 ok 值的 isErr 检查）可保留 `if (x.isErr()) return status(...)` 形式

### 4. 装配与 DI

依赖单向流入，测试可注入：

```
createEnv() → createDeps(env) → buildApp(options) → createPlugins(options) → routes
```

- app 不读 `process.env`：env.ts 集中校验；deps/plugins 只消费注入值，无全局常量
- `buildApp(options)` 与 `import.meta.main` 分离：生产入口构造 deps，
  测试直接注入 test 依赖（db/redis/secret），测试文件零 env 依赖
- 路由工厂的插件参数类型：`Omit<AppOptions, 'corsOrigin'>`

### 5. 队列

- 队列名 / job 名 / payload 类型定义在领域内 `jobs.ts`（纯契约，零依赖）
- handler 只消费纯数据 `(data, logger)`，放在领域内
- BullMQ 适配（createWorker/createDispatcher/Redis 连接）在 apps/worker；
  消费者在 `registry.ts` 注册；生产方在 app 侧 `createQueue`
- 跨域副作用优先写 outbox 事件（与业务写入同事务），由 worker 异步投递；
  事件 → 通知渠道的映射放 `usecases/notifications`，模板与发送放 `apps/worker`
- 事件投递语义为 at-least-once：下游需幂等（邮件用确定性 jobId 去重）

### 6. 数据库变更

1. 修改 `packages/database/src/schema/*.ts`
2. `pnpm --filter @yongstack/database db:generate`
3. 检查生成的 SQL 并提交到 `packages/database/src/migrations/`（CI 会在真实 PG 重放）

### 7. 用户可见文案 i18n

**口径**：只翻译**终端用户可见**的服务端文案（API 错误 `message` / 限流 429 / 会话守卫 / 通知邮件）。
面向开发者的一律不译：OpenAPI `summary`/`description`、Elysia 校验错误、日志。

**模型：标记 + 提取（gettext 式）**。用户可见文案必须用标记函数包裹：

- **标记**：`i18n('英文源串', params?)`。controller 经 `localePlugin` 的 `derive` 每请求注入
- **基础设施边界**（session 守卫、限流 429）用显式 `translate(locale, '源串')`
- **语言协商**：`X-Locale` / `?lang=` → `Accept-Language`（q 值）→ env `DEFAULT_LOCALE`
- **i18n 是呈现层职责**：domain/usecase 禁止 import `@yongstack/i18n`（eslint `i18n/no-core-import`）

catalog 自动生成/校验（`packages/i18n/src/catalog/{en,zh-CN}.json`，勿手改 en）：

```bash
pnpm i18n:extract   # 扫描标记, 生成 en.json + 合并 zh-CN.json(保留既有译文)
pnpm i18n:check     # 漏译/陈旧则退出 1 (pre-commit + CI 门禁)
```

新增/修改文案的流程：写标记（英文源串）→ `pnpm i18n:extract` → 在 `zh-CN.json` 补译文。

## 测试

两类集成测试（都需要本地 postgres + redis）：

- **domain/usecase 测试**：直连 `TESTING_DATABASE_URL` 测试库（prepareTestDb / resetDb / flushTestRedis）
- **app 路由级测试**（`apps/*/src/app.test.ts`）：`buildApp(createTestDeps(...))` 注入 test 依赖，Eden treaty 调接口

Eden treaty 返回判别联合，断言用收窄而非可选链：

```ts
const res = await api.orders.post({ items: [...] }, { fetch: { headers: { cookie } } })
if (res.error !== null) throw res.error
expect(res.data.totalAmount).toBe('15.00')
```

## 质量与工具

- pre-commit 自动执行 Prettier + ESLint；commit-msg 校验 Conventional Commits
- `ponytail:` 开头的注释 = 已知技术债（含背景与解决方向），新债沿用该标记并登记 docs/tech-debt.md
- 编辑器：Zed 配置在 `.zed/settings.json`（Prettier 保存格式化；ESLint 扩展获得诊断）

## 上游依赖待验证（elysia 2.0 发布后）

elysia 2.0 已进入 beta（2026-08 时点 beta.4），eden 配套 2.x 未发版。
升级后逐项实测以下已知问题，确认修复后移除对应 workaround：

- **eden treaty PATCH body 坍缩为 never**：涉及动态段 `:id` 子路由 + PATCH 时可能需要 `as never`
- **exact-mirror Union 警告**：`warn: [exact-mirror] TypeBox's TypeCompiler is required to use Union`，
  属降级路径警告，不影响正确性

## CI / Docker

- GitHub Actions：ESLint + Prettier + i18n → typecheck → build → commitlint → 真实 Postgres 迁移重放 → e2e（含 SeaweedFS）→ Docker 镜像构建验证
- 镜像：根目录 Dockerfile，`--build-arg APP=<app 名>` 选择服务；docker compose 含 migrate 前置服务
- compose 容器内网互访用 `postgres:5432` / `redis:6379`；若本地用非 compose 方式跑 PG，
  端口以 `.env` 的 `DATABASE_URL` 为准——两套环境不能共用同一份 `.env` 端口配置
