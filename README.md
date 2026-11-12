# yongstack

个人全栈技术栈模板：领域无关的 monorepo 工程底座。当前包含用户认证与 Session，后续通过 `domains/` + `usecases/` 扩展任意业务领域。

## 定位

- **不绑定业务领域**：仓库内没有任何具体业务模型
- **开箱即用**：API、前端、worker、数据库、队列、对象存储、可观测性、CI/Docker 已接线
- **可扩展**：新增领域只需要在 `domains/*`、`usecases/*`、`apps/*` 中增量实现

## 当前能力

| 模块     | 说明                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------- |
| Monorepo | pnpm workspace + Turborepo，Bun 运行时，统一 lint / format / typecheck                          |
| API      | ElysiaJS + TypeBox，`/info`、`/health`、`/metrics`、`/docs`                                     |
| 前端     | React 19 + TanStack Router + Tailwind 4 + shadcn/ui，Eden treaty 类型安全调用                   |
| 用户认证 | 邮箱密码 + 手机号验证码登录；注册/登出/me/资料；邮箱验证、找回/修改密码；Argon2id + 限流        |
| 权限     | 完整 RBAC：roles / permissions / user_roles；后台准入按 `admin:access` 权限，支持自定义后台角色 |
| 限流     | 认证限流（IP）+ 通用业务限流（userId 优先、IP 兜底），路由级宏                                  |
| 会话     | 活跃会话列表、单会话撤销、退出其他设备；按应用隔离 cookie                                       |
| 队列     | BullMQ 封装与 worker 运行时，消费者与健康/指标端点                                              |
| 通知     | outbox → notifications usecase → console/SMTP 邮件；注册欢迎邮件                                |
| 设置     | 运行时设置与 `feature.*` 功能开关，管理端可视化编辑                                             |
| 后台用户 | 用户列表、角色分配、启用/禁用、撤销全部会话；角色/权限自助 CRUD、系统角色复制                   |
| 数据     | Drizzle ORM + postgres.js，迁移、事务 helper、测试库工具                                        |
| 存储     | S3 兼容对象存储（SeaweedFS / R2 / COS）；小文件直传 + 大文件预签名直传                          |
| 媒体资源 | 管理端上传图片/PDF、列表、图片预览、复制 URL、下载与软删除                                      |
| 队列运维 | outbox 事件列表/统计/批量重放 + BullMQ job 详情/重试/删除/scheduler（管理端）                   |
| 可观测性 | Prometheus 指标 + Grafana 大屏 + Alertmanager 告警规则 + Sentry 异常上报（可选 DSN）            |
| 数据保留 | outbox/令牌/验证码/审计/幂等键按天清理；BullMQ scheduler 驱动每日 sweep                         |
| 备份部署 | 单机生产 compose（Caddy TLS）+ pg_dump 备份/恢复脚本 + 部署/恢复文档                            |
| 工程化   | ESLint boundaries、Prettier、commitlint、lefthook、GitHub Actions、knip                         |

## 架构

目录即分层，依赖方向“由外向内”，由 eslint-plugin-boundaries（值导入）+ 自研规则（type 导入、表归属、跨域读、事务、错误码、i18n）编译期强制：

```
apps/       composition root + presentation   最外层: 装配/HTTP 映射/cookie 签发, 不含业务编排
usecases/   编排层         跨域用例; 外部副作用(队列等)经本层定义的端口接口注入
domains/    实体域         纯业务逻辑(业务落地后新增)
packages/   基础设施       database · http · queue · redis · session · storage · mailer · sms · observability · shared · i18n · i18n-web · eden-client · ui · testkit · tsconfig
```

- 每个域固定三文件：`model.ts`（TypeBox DTO）/ `service.ts`（纯业务，neverthrow Result）/ `index.ts`（公共出口）
- 错误码 `err('SCREAMING_SNAKE')`，控制器 switch 穷举 + `assertNever`
- 新增/改名 domain 或 usecase 无需改 ESLint 配置（目录通配）

## 技术栈

ElysiaJS + TypeBox（API 契约）、Drizzle + postgres.js（ORM）、BullMQ（队列）、Redis 会话、React 19 + TanStack Router + Tailwind 4 + shadcn/ui（前端）、Playwright（e2e）、neverthrow（Result）、Turborepo。

## 快速开始

```bash
pnpm bootstrap   # 首次：装依赖、生成 .env、起基础设施、建 bucket、迁移数据库、seed 管理员
pnpm dev         # 日常启动全部服务
```

需要 Docker；没有 Docker 或使用 R2/COS 时见 [docs/onboarding.md](docs/onboarding.md)。

| 服务                     | 地址                           |
| ------------------------ | ------------------------------ |
| app-web                  | http://localhost:5173          |
| admin-web                | http://localhost:5174          |
| app-api / Swagger        | http://localhost:3000（/docs） |
| admin-api / Swagger      | http://localhost:3001（/docs） |
| worker 健康/指标         | http://localhost:3100          |
| SeaweedFS S3（本地媒体） | http://localhost:8333          |

本地管理员（bootstrap 自动 seed，可在 `.env` 修改）：

```text
admin@example.com / admin123456
```

认证接口：

| 应用      | 接口                                                                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| app-api   | `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET/PATCH /auth/me`                                                            |
| app-api   | `POST /auth/phone/request-code` · `POST /auth/phone/login` · `POST /auth/phone/bind/request-code` · `POST /auth/phone/bind` · `DELETE /auth/phone` |
| admin-api | `POST /auth/login` · `POST /auth/logout` · `GET /auth/me`（仅 admin）                                                                              |
| admin-api | `POST /auth/phone/request-code` · `POST /auth/phone/login`（仅已有 admin）                                                                         |

会话 cookie 按应用隔离：app 为 `yongstack_session`，admin 为 `yongstack_admin_session`。

文件上传：小文件 `POST /files`；大文件先 `POST /files/presign` 拿预签名 URL，直传后 `POST /files/:id/confirm`。
管理端运维：`/admin/outbox`（事件列表/统计/重放）与 `/admin/queues`（队列 job 计数）。

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
pnpm db:rbac-sync       # 同步默认角色/权限(新增权限码后执行)
pnpm db:backup          # PostgreSQL 全量备份
pnpm db:restore <file>   # 恢复备份
pnpm prod:up            # 单机生产 compose 启动
```

测试需要本地 postgres + redis；e2e 还需要 SeaweedFS（`TESTING_*` 与 `STORAGE_*` 配置见 `.env.example`）。

## 目录

```
apps/
  admin-api/       管理端 API
  admin-web/       管理后台
  app-api/         客户端 API
  app-web/         客户端 Web
  e2e/             Playwright 冒烟测试
  worker/          队列运行时

packages/
  database/        Drizzle schema / 迁移 / 事务
  eden-client/     Eden 类型工具
  i18n-web/        前端轻量 i18n（Provider + 语言切换）
  http/            插件、指标、安全头、服务启动
  i18n/            语言协商与翻译 catalog
  mailer/          邮件 provider（console / SMTP）
  observability/   Sentry 错误上报适配（无 DSN 时 no-op）
  sms/             短信 provider（console，可扩展）
  queue/           BullMQ 封装
  redis/           Redis 客户端
  session/         Redis 会话 + 限流
  shared/          Result、日志、env、分页
  storage/         S3 兼容对象存储
  testkit/         测试数据工厂
  tsconfig/        共享 TypeScript 配置
  ui/              通用 UI 组件（shadcn/ui · Base UI）

domains/
  audit/           操作审计日志
  file/            文件元数据与通用附件关联
  idempotency/     通用幂等键
  outbox/          通用领域事件
  rbac/            角色、权限、用户角色
  settings/        运行时设置与功能开关
  user/            用户、邮箱验证、密码令牌
usecases/
  auth/            注册与登录编排(密码/验证码, app+admin)
  account/         账号生命周期编排
  admin-users/     管理端用户管理编排
  admin-roles/     管理端角色/权限编排
  media/           管理端文件上传/确认编排
  notifications/   事件 → 通知任务
```

## 路线图

模板核心按里程碑逐步补齐：

1. ~~通知与事件：outbox、mailer（console/SMTP）、worker 消费~~
2. ~~运行时设置与功能开关~~
3. ~~RBAC、邮箱验证、找回密码、会话管理、管理端用户管理~~
4. ~~媒体上传与文件元数据~~
5. ~~审计日志与核心数据原语~~
6. ~~领域生成器、通用后台组件、测试工厂~~
7. ~~数据保留/定时任务、队列运维、错误上报/告警、备份/生产部署、角色自助管理~~

## 文档索引

| 文档                                             | 内容                            |
| ------------------------------------------------ | ------------------------------- |
| [CONTRIBUTE.md](CONTRIBUTE.md)                   | 分层规范、开发模式、新增域/用例 |
| [docs/template.md](docs/template.md)             | 模板使用与扩展指南              |
| [docs/onboarding.md](docs/onboarding.md)         | 新手上手与本地环境              |
| [docs/i18n.md](docs/i18n.md)                     | 后端用户文案 i18n               |
| [docs/object-storage.md](docs/object-storage.md) | 对象存储：R2 / COS / SeaweedFS  |
| [docs/deploy.md](docs/deploy.md)                 | 单机生产部署与升级回滚          |
| [docs/backup-restore.md](docs/backup-restore.md) | 备份、恢复与演练                |
| [docs/tech-debt.md](docs/tech-debt.md)           | 技术债索引（`ponytail:` 标注）  |

## License

[MIT](LICENSE)
