# nestup

租房平台全栈项目。当前已完成**工程底座 + 用户认证**：monorepo、API、前端、worker、数据库、队列、对象存储与可观测性已接线；用户注册/登录/会话/资料与管理端登录已可用，租房业务域按 `domains/` + `usecases/` 分层后续接入。

## 当前能力

| 模块     | 说明                                                                   |
| -------- | ---------------------------------------------------------------------- |
| Monorepo | pnpm workspace + Turborepo，Bun 运行时，统一 lint / format / typecheck |
| API      | ElysiaJS + TypeBox，`/info`、`/health`、`/metrics`、`/docs`            |
| 前端     | React 19 + TanStack Router + Tailwind 4，Eden treaty 类型安全调用      |
| 用户认证 | `domains/user`；注册/登录/登出/me/资料；Argon2id；Redis 会话 + 限流    |
| 队列     | BullMQ 封装与 worker 运行时，消费者注册位待业务接入                    |
| 数据     | Drizzle ORM + postgres.js，迁移、事务 helper、测试库工具               |
| 存储     | S3 兼容对象存储（本地 SeaweedFS / R2 / COS）                           |
| 可观测性 | Prometheus 指标端点 + Grafana 大屏 + 本地监控脚本                      |
| 工程化   | ESLint boundaries、Prettier、commitlint、lefthook、GitHub Actions      |

## 架构

目录即分层，依赖方向由 `eslint-plugin-boundaries` 编译期强制单向无环：

```
apps/       presentation   薄壳: storefront-api/web · admin-api/web · worker · e2e
usecases/   编排层         跨域用例(业务落地后新增)
domains/    实体域         纯业务逻辑(业务落地后新增)
packages/   基础设施       database · http · queue · redis · session · storage · shared · i18n · eden-client · tsconfig
```

- 每个域固定三文件：`model.ts`（TypeBox DTO）/ `service.ts`（纯业务，neverthrow Result）/ `index.ts`（公共出口）
- 错误码 `err('SCREAMING_SNAKE')`，控制器 switch 穷举 + `assertNever`
- 新增/改名 domain 或 usecase 无需改 ESLint 配置（目录通配）

## 技术栈

ElysiaJS + TypeBox（API 契约）、Drizzle + postgres.js（ORM）、BullMQ（队列）、Redis 会话、React 19 + TanStack Router + Tailwind 4（前端）、Playwright（e2e）、neverthrow（Result）、Turborepo。

## 快速开始

```bash
pnpm bootstrap   # 首次：装依赖、生成 .env、起基础设施、建 bucket、迁移数据库
pnpm dev         # 日常启动全部服务
```

需要 Docker；没有 Docker 或使用 R2/COS 时见 [docs/onboarding.md](docs/onboarding.md)。

| 服务                     | 地址                           |
| ------------------------ | ------------------------------ |
| storefront-web           | http://localhost:5173          |
| admin-web                | http://localhost:5174          |
| storefront-api / Swagger | http://localhost:3000（/docs） |
| admin-api / Swagger      | http://localhost:3001（/docs） |
| worker 健康/指标         | http://localhost:3100          |
| SeaweedFS S3（本地媒体） | http://localhost:8333          |

本地管理员（bootstrap 自动 seed，可在 `.env` 修改）：

```text
admin@example.com / admin123456
```

认证接口：

| 应用           | 接口                                                                                    |
| -------------- | --------------------------------------------------------------------------------------- |
| storefront-api | `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET/PATCH /auth/me` |
| admin-api      | `POST /auth/login` · `POST /auth/logout` · `GET /auth/me`（仅 admin）                   |

会话 cookie 按应用隔离：storefront 为 `nestup_session`，admin 为 `nestup_admin_session`。

常用命令：

```bash
pnpm bootstrap          # 首次初始化
pnpm bootstrap:check    # 只检查环境
pnpm dev                # 全部服务
pnpm typecheck
pnpm lint
pnpm check              # ESLint + Prettier
pnpm test
pnpm e2e
pnpm build
pnpm i18n:extract       # 生成/更新翻译 catalog
pnpm i18n:check         # 校验漏译/陈旧 key
```

测试需要本地 postgres + redis；e2e 还需要 SeaweedFS（`TESTING_*` 与 `STORAGE_*` 配置见 `.env.example`）。

## 目录

```
apps/
  admin-api/        B 端 API
  admin-web/        管理后台
  e2e/              Playwright 冒烟测试
  storefront-api/   C 端 API
  storefront-web/   C 端前端
  worker/           队列运行时
packages/
  database/         Drizzle schema / 迁移 / 事务
  eden-client/      Eden 类型工具
  http/             插件、指标、安全头、服务启动
  i18n/             语言协商与翻译 catalog
  queue/            BullMQ 封装
  redis/            Redis 客户端
  session/          Redis 会话 + 限流
  shared/           Result、日志、env、分页
  storage/          S3 兼容对象存储
  tsconfig/         共享 TypeScript 配置
domains/
  user/             用户注册/登录/资料
usecases/           跨域编排（待接入）
```

## 下一步

1. 确定租房核心模型（房源、租约、账单等）。
2. 在 `domains/*` 落地房源/租约实体域，在 `usecases/*` 编排跨域流程。
3. 补充密码找回、管理端用户管理、活跃会话管理（依赖邮件/队列基础设施）。
4. 阅读 [CONTRIBUTE.md](CONTRIBUTE.md) 的分层与开发模式。

## 文档索引

| 文档                                             | 内容                            |
| ------------------------------------------------ | ------------------------------- |
| [CONTRIBUTE.md](CONTRIBUTE.md)                   | 分层规范、开发模式、新增域/用例 |
| [docs/onboarding.md](docs/onboarding.md)         | 新手上手与本地环境              |
| [docs/i18n.md](docs/i18n.md)                     | 后端用户文案 i18n               |
| [docs/object-storage.md](docs/object-storage.md) | 对象存储：R2 / COS / SeaweedFS  |
| [docs/tech-debt.md](docs/tech-debt.md)           | 技术债索引（`ponytail:` 标注）  |

## License

[MIT](LICENSE)
