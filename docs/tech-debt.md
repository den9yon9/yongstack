# TECH-DEBT.md — 技术债索引

> 索引全仓 `ponytail:` 标注的已知技术债。每条约一行 + 偿还触发条件；
> 新债沿用 `ponytail:` 注释标记并在此登记。排序: 偿还触发越近越靠前。

## 债项

| #   | 位置                                                                                                       | 债                                                                                                           | 触发条件 / 偿还时机                                                 |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 1   | `packages/session/src/rateLimit.ts`                                                                        | nazli 顶层规则会全局 onRequest 计数；限流只走路由级宏                                                        | 换库或修复 nazli 后移除 workaround 说明                             |
| 2   | `packages/http/src/serverFactory.ts`                                                                       | 只认 `x-request-id` 请求头                                                                                   | 网关若用 `x-correlation-id` 等需加进数组                            |
| 3   | `apps/app-web/src/libs/api/client.ts`、`apps/admin-web/src/libs/api/client.ts`                             | treaty base 必须完整 URL，`''` 会补 https:// 前缀                                                            | eden 修复 base 解析                                                 |
| 4   | `apps/app-web/vite.config.ts`、`apps/admin-web/vite.config.ts`                                             | 全量代理到 API，HttpOnly cookie 同源透传                                                                     | 生产走 nginx，本地 dev 简化方案                                     |
| 5   | `packages/shared/src/env.ts`                                                                               | 非 elysia 消费者需手动补 `uri`/`uuid`/`email` format 注册                                                    | 随 elysia 2.0 schema 内核替换确认是否消失                           |
| 6   | `packages/database/src/transaction.ts`                                                                     | `isResult` 鸭子探测（框架无 Result 语义）                                                                    | 框架提供 Result 语义后替换                                          |
| 7   | `apps/e2e/playwright.config.ts`                                                                            | 只安装 chromium，未覆盖 webkit/firefox                                                                       | 需要跨浏览器验证时补充                                              |
| 8   | `domains/rbac`                                                                                             | 自定义角色/权限编辑与角色管理 UI 未实现；当前仅内置 member/admin                                             | 需要自定义角色时补齐                                                |
| 9   | `packages/session/src/sessionPlugin.ts`                                                                    | session 缓存 roles/permissions 快照；角色定义编辑不会使既有会话失效（用户级变更已由 destroyAllForUser 覆盖） | 引入角色定义编辑功能时，给用户加 accessVersion 版本号并在请求时比对 |
| 10  | `apps/app-api/src/routes/phone.ts`、`apps/admin-api/src/routes/auth.ts`                                    | sms.send 在请求路径同步 await，真实厂商慢时会拉高登录延迟                                                    | 接入真实厂商后改走队列/outbox 异步发送                              |
| 11  | `apps/app-api/src/routes/user.ts`、`apps/admin-api/src/routes/auth.ts`、`apps/app-api/src/routes/phone.ts` | 登录编排（getUserAccess → updateLastLogin → startSession）三处重复                                           | 第四个登录入口出现前抽共享应用服务/helper                           |
| 12  | `apps/app-api/src/routes/file.ts`                                                                          | 上传用 arrayBuffer 全量进内存                                                                                | 允许大文件时改为流式上传                                            |

## 历史结清

- ~~认证/账号生命周期/会话管理未完成~~（RBAC + 邮箱验证 + 找回/改密 + 活跃会话 + 管理端用户管理，2026-11-07）

- ~~身份表无用户域与登录 API~~（`domains/user` + app/admin 认证路由 + per-app session cookie，2026-11-07，tech-debt #10）

- ~~worker 空转 keepalive~~（注册邮件/outbox 消费者后移除 `setInterval`，2026-11-07）

- ~~幂等键事后插入存在并发重复副作用~~（先 in_progress 占位再执行 handler，2026-11-08）
- ~~文件下载/删除越权判定留在 controller~~（`getFileForActor`/`softDeleteFileForActor` 下沉到 `domains/file`，2026-11-08）
- ~~软删文件对象存储无清理兜底~~（`fileCleanupWorker` 每轮扫描软删超 `FILE_CLEANUP_MIN_AGE_MS` 的记录补偿删除，2026-11-08）
- ~~outbox payload 无类型契约、无效事件被静默吞掉~~（`OutboxEventMap` 注册表 + 生产侧编译期约束 + 消费侧失败 `markFailed`，2026-11-08）
- ~~审计与业务写不同事务、覆盖不一致~~（`withAudit` 同事务封装 + admin 登录/app 文件操作补审计，2026-11-08）
