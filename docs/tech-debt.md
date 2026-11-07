# TECH-DEBT.md — 技术债索引

> 索引全仓 `ponytail:` 标注的已知技术债。每条约一行 + 偿还触发条件；
> 新债沿用 `ponytail:` 注释标记并在此登记。排序: 偿还触发越近越靠前。

## 债项

| #   | 位置                                                                           | 债                                                         | 触发条件 / 偿还时机                       |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------- |
| 1   | `packages/session/src/rateLimit.ts`                                            | nazli 顶层规则会全局 onRequest 计数；限流只走路由级宏      | 换库或修复 nazli 后移除 workaround 说明   |
| 2   | `packages/http/src/serverFactory.ts`                                           | 只认 `x-request-id` 请求头                                 | 网关若用 `x-correlation-id` 等需加进数组  |
| 3   | `apps/app-web/src/libs/api/client.ts`、`apps/admin-web/src/libs/api/client.ts` | treaty base 必须完整 URL，`''` 会补 https:// 前缀          | eden 修复 base 解析                       |
| 4   | `apps/app-web/vite.config.ts`、`apps/admin-web/vite.config.ts`                 | 全量代理到 API，HttpOnly cookie 同源透传                   | 生产走 nginx，本地 dev 简化方案           |
| 5   | `packages/shared/src/env.ts`                                                   | 非 elysia 消费者需手动补 `uri`/`uuid`/`email` format 注册  | 随 elysia 2.0 schema 内核替换确认是否消失 |
| 6   | `packages/database/src/transaction.ts`                                         | `isResult` 鸭子探测（框架无 Result 语义）                  | 框架提供 Result 语义后替换                |
| 7   | `apps/e2e/playwright.config.ts`                                                | 只安装 chromium，未覆盖 webkit/firefox                     | 需要跨浏览器验证时补充                    |
| 8   | `packages/i18n/src/catalog/en.json`                                            | 当前覆盖会话/认证相关文案                                  | 业务路由接入后随 `i18n:extract` 增长      |
| 9   | `domains/user`、`apps/app-api/src/routes/user.ts`                              | 密码找回/重置与邮箱验证未实现                              | M3 账号生命周期接入时补齐                 |
| 10  | `apps/admin-api/src/routes/auth.ts`                                            | 管理端用户管理（列表/改角色/禁用）与角色变更后踢会话未实现 | 管理端业务落地时补齐                      |
| 11  | `packages/session/src/sessionPlugin.ts`                                        | 未提供活跃会话列表/单会话撤销 API                          | 需要多端会话管理时补齐                    |

## 历史结清

- ~~身份表无用户域与登录 API~~（`domains/user` + app/admin 认证路由 + per-app session cookie，2026-11-07，tech-debt #10）

- ~~worker 空转 keepalive~~（注册邮件/outbox 消费者后移除 `setInterval`，2026-11-07）
