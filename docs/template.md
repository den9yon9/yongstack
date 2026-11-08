# 模板使用指南

Yongstack 是领域无关的全栈模板。本文说明如何从零扩展一个新业务领域。

## 1. 生成领域骨架

```bash
pnpm gen domain billing
# 预览不落盘
pnpm gen domain billing --dry-run
```

生成内容：

```
domains/billing/
  package.json
  tsconfig.json
  src/model.ts
  src/service.ts
  src/index.ts
  src/service.test.ts
```

生成后：

```bash
pnpm install
pnpm --filter @yongstack/billing typecheck
```

然后替换 `model.ts` / `service.ts` 中的 placeholder，补真实业务逻辑与测试。

## 2. 数据库表与迁移

1. 在 `packages/database/src/schema/<领域>/` 添加表定义。
2. 在 `packages/database/src/schema/index.ts` 导出表。
3. 如需 API 契约，在 `packages/database/src/model.ts` 的 `table.select/insert/update` 中注册。
4. 生成迁移：

```bash
pnpm --filter @yongstack/database db:generate
pnpm --filter @yongstack/database db:migrate
```

检查生成的 SQL 并提交到 `packages/database/src/migrations/`。

## 3. 领域实现约定

- `model.ts`：TypeBox schema，从 `table.select/insert/update` 派生。
- `service.ts`：纯业务函数，依赖 `DbClient` 注入，失败返回 `err('CODE')`。
- `index.ts`：只导出函数与类型。
- 域之间禁止互调；跨域流程放 `usecases/*`。
- 需要原子性时使用 `withTransaction`，禁止直接 `.transaction(`。

详见仓库根目录 `CONTRIBUTE.md`。

## 4. 测试工厂

`@yongstack/testkit` 提供通用测试数据：

```ts
import { createAdmin, createUser, createFile, createAuditLog } from '@yongstack/testkit'

const { user, password } = await createUser(db)
const { user: admin } = await createAdmin(db)
const file = await createFile(db, { ownerId: user.id })
const log = await createAuditLog(db, { actorId: admin.id })
```

`createUser` 默认密码 `password123`，默认角色 `member`；`createAdmin` 角色 `admin`。

## 5. 通用后台组件

`@yongstack/ui` 提供：

- `PageHeader`
- `EmptyState`
- `DataTable`
- `FormField`
- `ConfirmDialog`
- `FileUpload`

在 `apps/admin-web` 中直接导入：

```tsx
import { PageHeader, DataTable } from '@yongstack/ui'
```

Tailwind 已在 `apps/admin-web/src/styles.css` 通过 `@source` 扫描 UI 包。

## 6. 扩展检查清单

- [ ] `domains/<name>` 通过 `pnpm gen domain`
- [ ] 表定义 + 迁移生成并提交
- [ ] `service.ts` 返回 `Result`，错误码 SCREAMING_SNAKE
- [ ] 需要 payload 的错误使用对象错误或 `DomainError` 子类；子类实现 `toJSON()`
- [ ] 路由错误映射穷举 + `assertNever`（`DomainError` 子类用 `instanceof` 收窄）
- [ ] 用户可见文案使用 `i18n(...)`，并跑 `pnpm i18n:extract`
- [ ] 写域测试与接口测试
- [ ] `pnpm check && pnpm typecheck && pnpm build && pnpm test && pnpm e2e`
- [ ] 涉及管理端操作时记录审计日志
- [ ] 涉及重复提交的写接口考虑 `withIdempotency`
