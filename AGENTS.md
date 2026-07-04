# YongStack AI 开发指南

## 项目概况

全栈电商管理后台，pnpm + Turborepo monorepo。

- **运行时**: Bun
- **API**: Elysia.js + TypeBox + Drizzle ORM + PostgreSQL
- **Admin**: React 19 + Vite 7 + Tailwind CSS v4 + daisyUI 5
- **端到端类型安全**: Eden Treaty
- **格式化/检查**: Biome 2.3（2空格缩进，双引号，noExplicitAny: error）
- **Husky + commitlint**: Conventional Commits

```
yongstack/
  apps/
    api/       -- 后端 API
    admin/     -- 管理后台 SPA
  packages/
    db/        -- 共享数据库（schema + model + client）
  AGENTS.md    -- ← 你正在读的文件
```

---

## API 规范

### 1. 模块必须三文件结构

```
modules/<name>/
  index.ts   # Controller：路由定义
  model.ts   # 所有 DTO（TypeBox），挂载到 .model()
  service.ts # 纯业务逻辑 + 数据库操作
```

### 2. 三层职责边界

| 层 | 职责 | ❌ 禁止 |
|---|---|---|
| **index.ts** | 定义路由、挂载 model、解析 body/query/cookie/params，调 service | 禁止直接调 `db.query/db.insert` |
| **model.ts** | 定义所有 `t.Object(...)` DTO 并注册到 `.model()` | 禁止在路由里写内联 `t.Object(...)` |
| **service.ts** | 纯 ts 函数，接收普通参数/返回数据，与 db 交互 | 禁止接收 Elysia Context（set/cookie/request） |

**示例（正确做法）：**
```typescript
// model.ts
export const catModel = new Elysia().model({
  CreateCatDTO: t.Object({ name: t.String() }),
  CatResponse: db.select.productCategory,
});

// service.ts
export async function createCat(data: CatModel["CreateCatDTO"]) {
  const [cat] = await db.insert(schema.productCategory).values(data).returning();
  if (!cat) throw status(400, "创建失败");
  return cat;
}

// index.ts
app.use(catModel).post("", ({ body }) => createCat(body), {
  body: "CreateCatDTO", response: "CatResponse",
});
```

### 3. 跨模块调用

- ✅ 允许直接 `import { xxx } from "../other/service"` 调其他模块的 service
- ❌ 禁止引入其他模块的 `index.ts`（Controller）

### 4. 路由约定

- 名词复数：`/categories`、`/products`
- 参数变量：`/products/:id`、`/products/:id/status`
- HTTP Method 表达操作，不在 URL 加动词（例外：`/phone/code`、`/phone/login`）
- 鉴权：`.use(isAuthenticated)` 链式调用，从 signed cookie 取 `userId`

### 5. 错误处理

- 常规错误：service 层 `throw status(404/400/401, "描述")`
- 业务分支错误：controller 层 `return status(402, "描述")`
- 不包裹 `{code, data, message}`，直接用 HTTP 状态码

### 6. DTO 命名

- 入参：`XxxDTO` / `XxxQueryDTO`, `CreateXxxDTO`, `UpdateXxxDTO`
- 出参：`XxxResponse`, `PaginatedXxxResponse`
- Model 对象名：`xxxModel`（小驼峰）
- Model 类型：`type XxxModel = InferModelsMap<typeof xxxModel>`

### 7. 文件上传

- 用 `processUpload(userId, file, scene)`（来自 `modules/file/service`）
- scene 参数表示业务场景（`"product"`、`"avatar"`）
- 返回上传后的 URL（`/tmp/<scene>/<uuid>.<ext>`）

---

## 数据库规范（`@yongstack/db`）

### 8. Schema 定义

```typescript
export const product = pgTable("product", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  status: productStatus("status").notNull().default("offline"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
});
```

- DB 列名：`snake_case`
- JS 导出名：`camelCase`
- 时间戳统一 `timestamp("xxx_at", { withTimezone: true })`
- 价格统一存**分（cents）**，类型 `integer`

### 9. 类型生成

- `packages/db/src/model.ts` 统一导出 `db.select.xxx` 和 `db.insert.xxx`
- API 中引入 `import { db } from "@yongstack/db/model"`
- 用 `db.select.xxx` / `t.Omit(db.select.xxx, [...])` 作为 response 类型
- 用 `t.Pick(db.insert.xxx, [...])` 作为 create/update 类型

### 10. 枚举

PostgreSQL 枚举定义在 `schema/enums.ts`，使用 `pgEnum()`。

当前枚举：`user_role`, `product_status`, `order_status`(8值), `pay_method`, `after_sale_type`, `after_sale_status`, `inventory_biz_type`

---

## Admin 规范

### 11. 路由定义

```typescript
export const Route = createFileRoute("/_studio/products")({
  staticData: { title: "商品管理", icon: "ShoppingBag", order: 10 },
  validateSearch: mySearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => { /* api call */ },
  component: ProductsPage,
});
```

- `staticData` 固定字段：`title`, `icon`(Lucide组件名), `order`, `showInNav`
- `showInNav: false` 隐藏导航，`showInNav` 未设置时默认显示
- 导航自动从 `routeTree` 递归收集

### 12. API 调用

- 统一通过 `src/libs/api.ts` 导出的 `api` 实例（Eden Treaty 类型安全）
- 全部走 TanStack React Query
- 示例：`api.categories.get()` / `api.product({ id }).delete()` / `api.product({ id }).status.patch({...})`
- 数据变更后调 `router.invalidate()` 或 `queryClient.invalidateQueries()`

### 13. 校验

- 使用 **Valibot**（非 TypeBox）
- Search params：`validateSearch` 中定义 schema
- 表单提交：`v.safeParse(Schema, data)`，错误用 `setErrors` 展示到字段
- 全局 toast：`toast.success()` / `toast.error()`

### 14. 组件

- 公共组件放 `src/components/`（Breadcrumb, ThemeSwitcher, ErrorUI）
- 工具函数放 `src/libs/`（api, queryClient, error）
- 页面函数组件名与路由文件名一致，用 PascalCase

---

## 工程化

### 15. Git

- Conventional Commits，由 commitlint + husky 自动校验
- Pre-commit 自动跑 `biome check --write`
- 自动生成文件（`routeTree.gen.ts`）不提交 lint 检查
- 禁止直接提交到 `main`，走 PR

### 16. Biome 强制规则

- 缩进 2 空格，双引号
- `noExplicitAny: error`
- `a11y: off`
- `organizeImports` 开启（保存时自动整理 import）

---

## 关键注意事项

1. `packages/db/src/index.ts` 中 **cart 被 export 了两次**（line 2 和 3 重复），记得只保留一次
2. `product/index.ts` 的 `POST /:id/cover` **直接调了 `db.update`**，违反了规范，应移到 service
3. 多处路由写了**内联 `params: t.Object({ id: t.Numeric() })`**，应统一放到 model.ts
4. Category 模块**未加 `isAuthenticated`**，如需生产环境加鉴权
5. `auth/service.ts` 的 SMS code 用**内存 Map** 存储，生产需替换为 Redis
6. 订单/购物车/售后/库存的 API **尚未实现**（schema 已完备）
7. Admin 端 `products/new.tsx` 和 `products/$id.tsx` 是**占位页**（"表单待实现"）
