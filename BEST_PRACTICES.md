# YongStack 最佳实践指南

## 目录

1. [项目概览](#1-项目概览)
2. [环境准备与启动](#2-环境准备与启动)
3. [后端开发规范（API）](#3-后端开发规范api)
4. [数据库层规范（DB）](#4-数据库层规范db)
5. [前端开发规范（WWW）](#5-前端开发规范www)
6. [小程序开发规范（WeApp）](#6-小程序开发规范weapp)
7. [类型共享与代码生成](#7-类型共享与代码生成)
8. [Git 规范](#8-git-规范)
9. [常见问题](#9-常见问题)

---

## 1. 项目概览

### 技术栈

| 层 | 技术 |
| --- | --- |
| 运行时 | Bun 1.3+ |
| 后端框架 | Elysia.js（TypeBox DTO） |
| 数据库 | PostgreSQL + Drizzle ORM |
| 前端框架 | React 19 + TanStack Router |
| 前端样式 | Tailwind CSS v4 |
| 小程序 | weapp-vite + Tailwind |
| 类型共享 | OpenAPI + openapi-typescript |
| API 客户端 | 自定制 openapi-fetch（status 类型收窄） |
| 包管理 | pnpm 10+ |
| 构建编排 | Turborepo 2.9+ |
| 代码规范 | Biome（格式化 + 检查 + import 排序） |
| 提交规范 | Conventional Commits + commitlint + Husky |

### 包依赖图

```
@yongstack/api  ───▶  @yongstack/db
(Bun + Elysia)       (Drizzle ORM + Schema)
                            ▲
@yongstack/www ───▶  @yongstack/openapi
(React SPA)              (自动生成的 TS 类型)

@yongstack/weapp ──▶  @yongstack/openapi-fetch
(微信小程序)              (类型安全的 HTTP 客户端)
```

- **`@yongstack/db`** — 数据库 schema 定义、Drizzle 客户端工厂、TypeBox 模型
- **`@yongstack/api`** — HTTP API 服务，依赖 db 包，通过 `@elysiajs/openapi` 暴露 OpenAPI JSON
- **`@yongstack/openapi`** — 从运行中 API 的 `/openapi/json` 自动生成的 TypeScript 类型
- **`@yongstack/openapi-fetch`** — 类型安全的 fetch 客户端（上游 openapi-fetch 的定制 fork，支持 status 收窄）
- **`@yongstack/www`** — React SPA，通过 openapi-fetch 调用 API
- **`@yongstack/weapp`** — 微信小程序，通过 openapi-fetch + wxFetch 适配器调用 API

---

## 2. 环境准备与启动

### 前置要求

- Bun >= 1.3.2
- pnpm >= 10
- PostgreSQL 运行中

### 首次启动

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp apps/api/.env.example apps/api/.env   # 如果存在 .env.example
# 编辑 .env，确保 DATABASE_URL 正确

# 3. 创建数据库并执行迁移
cd packages/db
bunx --bun drizzle-kit generate
bunx --bun drizzle-kit migrate
cd ../..

# 4. 生成 OpenAPI 类型（需要 API 正在运行）
#   先启动 API，再在另一个终端执行：
pnpm run gen

# 5. 启动开发服务器
pnpm run dev
```

### 日常开发

```bash
pnpm run dev          # 启动所有应用的开发模式
pnpm run typecheck    # 类型检查所有包
pnpm run build        # 构建生产版本
pnpm run gen          # 重新生成 OpenAPI 类型
pnpm run watch        # 监听 API 文件变更，自动重新生成 OpenAPI 类型
```

> **注意：** `pnpm run watch` 需要先启动 API，它会自动监听 API 模块文件的变更并重新生成前端类型。

---

## 3. 后端开发规范（API）

### 3.1 模块结构

每个功能模块遵循 **三层架构**，目录结构一致：

```
modules/<module>/
├── index.ts    # 路由 / 控制器 — 定义端点、绑定模型、引用 service
├── model.ts    # DTO 定义 — 使用 TypeBox（t.Object）定义请求体和响应体
└── service.ts  # 业务逻辑 — 纯函数，不感知 HTTP 上下文
```

**核心原则：**

- `service.ts` **不要引用** `cookie`、`request`、`response` 等 HTTP 对象
- `service.ts` 只接收原始数据类型（`number`、`string` 等）作为参数
- 错误通过 `throw status(code, msg)` 抛出
- `model.ts` 中的 DTO 通过**字符串名**在路由中引用（Elysia 的 model 系统）

### 3.2 新增模块步骤

以新增一个 `post` 模块为例：

```ts
// modules/post/model.ts
import Elysia, { t } from "elysia";

export const postModel = new Elysia().model({
  CreatePostDTO: t.Object({
    title: t.String({ minLength: 1 }),
    content: t.String(),
  }),
  Post: t.Object({
    id: t.Number(),
    title: t.String(),
    content: t.String(),
    authorId: t.Number(),
    createdAt: t.Date(),
  }),
});

export type PostModel = InferModelsMap<typeof postModel>;
```

```ts
// modules/post/index.ts
import Elysia from "elysia";
import { isAuthenticated } from "../../lib/guard";
import { postModel } from "./model";
import { createPost, getPost, listPosts } from "./service";

export const post = new Elysia({ prefix: "/posts" })
  .use(postModel)
  .use(isAuthenticated)       // 需要登录
  .post("/", ({ userId, body }) => createPost(userId, body), {
    body: "CreatePostDTO",
    response: "Post",
  })
  .get("/", () => listPosts(), {
    response: t.Array(t.Ref("Post")),   // 或复用 model 中类型
  });
```

```ts
// modules/post/service.ts
import * as schema from "@yongstack/db/schema";
import { eq } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../lib/db";
import type { PostModel } from "./model";

export async function createPost(
  userId: number,
  data: PostModel["CreatePostDTO"],
) {
  // ... 业务逻辑
}

export async function listPosts() {
  return db.query.post.findMany();
}
```

然后挂载到 `main.ts`：

```ts
import { post } from "./modules/post";
// ...
app.use(post);
```

### 3.3 DTO 定义规约

- 使用 TypeBox `t.Object()` 定义，不用手写 TypeScript 类型
- 在 `model.ts` 中导出 `InferModelsMap` 类型，供 `service.ts` 引用入参类型
- 在路由中使用**字符串名**（如 `body: "CreatePostDTO"`）而非内联 schema，以便 OpenAPI 生成更完整的 spec

```ts
// model.ts
export const authModel = new Elysia().model({
  PasswordLoginDTO: t.Object({
    username: t.String(),
    password: t.String(),
  }),
  User: t.Omit(db.select.user, ["password", "phone"]),   // 复用 TypeBox schema
});
export type AuthModel = InferModelsMap<typeof authModel>;
```

### 3.4 Error 处理

- **DTO 校验错误** 由 Elysia 自动处理（返回 422 或 400）
- **业务错误** 在 service 中手动抛出：`throw status(401, "用户名或密码错误")`
- **服务器错误** 由全局 500 guard 兜底（`apps/api/main.ts` 中配置）
- 不要吞异常，让 Elysia 的错误处理器统一处理

### 3.5 鉴权

所有需要登录的接口使用 `isAuthenticated` guard 插件：

```ts
// apps/api/lib/guard.ts
export const isAuthenticated = (app: Elysia) =>
  app.derive(({ cookie: { userId }, status }) => {
    if (!userId.value) {
      throw status(401, "Unauthorized: 请先登录");
    }
    return { userId: Number(userId.value) };
  });
```

在模块中使用：

```ts
app.use(isAuthenticated).get("/mine", ({ userId }) => getMine(userId));
```

userId 会自动从签名 cookie 中解析并注入到路由处理函数中。

### 3.6 文件上传

- 使用 `scene` 参数区分上传场景（如 `avatar`、`chat`）
- 每个场景有不同的文件类型和大小限制（定义在对应 model 中）
- 上传记录写入 `file_record` 表，通过 `refCount` 管理引用计数
- `apps/api/scripts/cleanup.ts` 定期清理 `refCount = 0` 的过期文件

---

## 4. 数据库层规范（DB）

### 4.1 Schema 定义

在 `packages/db/src/schema/` 下新增表文件：

```ts
import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: serial("id").primaryKey(),
  // 列名使用 snake_case，字段名使用驼峰
  wechatOpenId: varchar("wechat_open_id", { length: 256 }).unique(),
  nickname: varchar("nickname", { length: 256 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  uniqueIndex("user_username_idx").on(table.username),
]);
```

规约：

- 列名用 **snake_case**
- 字段名（TypeScript）用 **camelCase**
- 时间戳统一用 `timestamp with time zone`
- 索引在第三个参数中定义

### 4.2 模型导出

在 `packages/db/src/index.ts` 中 re-export：

```ts
export * from "./schema/user";
export * from "./schema/file_record";
```

其他包通过 `@yongstack/db/schema` 导入：

```ts
import * as schema from "@yongstack/db/schema";
import { eq } from "drizzle-orm";
```

### 4.3 drizzle-typebox 模型

在 `packages/db/src/model.ts` 中定义，用于生成 TypeBox schema 供 API 层使用：

```ts
export const db = {
  insert: { user: insert(schema.user) },
  select: { user: select(schema.user) },
};
```

### 4.4 迁移流程

```bash
# 1. 修改 schema 文件后，生成迁移
cd packages/db
bunx --bun drizzle-kit generate

# 2. 检查生成的 SQL 文件，确认无误后执行
bunx --bun drizzle-kit migrate
```

- 不要手动修改已生成的迁移文件
- 后续修改 schema 时增量生成新迁移
- 迁移输出到 `packages/db/drizzle/` 目录，需要提交到 git

### 4.5 数据库连接

```ts
// apps/api/lib/db.ts
import { createDb } from "@yongstack/db/client";
export const db = createDb(env.DATABASE_URL);   // 使用 pg.Pool 连接池
```

---

## 5. 前端开发规范（WWW）

### 5.1 路由

使用 TanStack Router 文件路由：

```ts
// routes/some-page.tsx
import { createFileRoute } from "@tanstack/react-router";

interface SearchParams {
  page?: number;
}

export const Route = createFileRoute("/some-page")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    page: Number(search.page) || 1,
  }),
});

function RouteComponent() {
  const { page } = Route.useSearch();   // 类型安全的 search params
  return <div>Page {page}</div>;
}
```

- 路由组件写在 `routes/<path>.tsx` 文件中
- `routeTree.gen.ts` 由构建工具自动生成，**不要手动编辑**
- 组件内使用 `Route.useSearch()`、`useNavigate()`、`useParams()` 获取路由状态

### 5.2 API 调用

统一通过 `api` 客户端对象调用，类型完全由 OpenAPI 推导：

```ts
import { api } from "../libs/api";

// GET 请求
const { data: user } = await api.GET("/user/mine");

// POST 请求（带 body）
const { data, error } = await api.POST("/auth/login", {
  body: { username, password },
});

// 利用 status 收窄类型
const res = await api.POST("/auth/phone/code", { body: { phone } });
if (res.response.status === 429) {
  // TypeScript 自动将 error 收窄为 { remainingSeconds: number }
  const remaining = (res.error as { remainingSeconds?: number })?.remainingSeconds;
}
```

- 不需要手动定义接口类型，全部从 `@yongstack/openapi` 推导
- **不要**在 `packages/` 外直接 import `@yongstack/openapi` 中的类型，通过 `api.POST()` 的返回值自动获取
- 如果需要在组件中引用类型，使用 `api` 的推导即可

### 5.3 表单验证

使用 valibot（已经配置在依赖中）：

```ts
import * as v from "valibot";

const LoginSchema = v.object({
  username: v.pipe(v.string(), v.minLength(1, "请输入用户名")),
  password: v.pipe(v.string(), v.minLength(6, "密码至少6位")),
});

// 在提交处理函数中
const result = v.safeParse(LoginSchema, { username, password });
if (!result.success) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.issues) {
    const key = issue.path?.[0]?.key as string;
    if (key) fieldErrors[key] = issue.message;
  }
  setErrors(fieldErrors);
  return;
}
```

- 使用 `safeParse` 而非 `parse`（不抛异常，返回 result 对象）
- 使用 `issue.path[0].key` 提取字段名用于内联错误显示
- 错误通过 `sonner.toast.error()` 展示

### 5.4 UI 风格

当前使用纯 Tailwind CSS，**没有第三方 UI 组件库**。

保持以下视觉一致性：

```tsx
// 按钮
<button className="bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white
  text-sm font-medium rounded-xl transition-all active:scale-[0.98]">

// 输入框
<input className="h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm
  text-gray-900 placeholder-gray-400
  focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900">

// 卡片
<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
```

- 主色：`gray-900`（文字/背景）、`gray-50`（页面背景）
- 圆角：卡片 `rounded-2xl`，输入框/按钮 `rounded-xl`
- 按钮交互：`transition-transform active:scale-[0.98]`

### 5.5 登录态管理

前端不存储 token，依赖 httpOnly cookie：

- **登录成功** 后只需调用 `navigate({ to: "/" })` 跳转（cookie 由 API 自动设置）
- **检查登录状态** 调用 `api.GET("/user/mine")`
- **退出登录** 调用 `api.POST("/auth/logout")`，然后刷新页面
- 全局错误 UI（`ErrorUI.tsx`）已内置对 401/403 的处理，显示 "Sign In" 按钮

### 5.6 Toast 通知

使用 sonner（已在 `__root.tsx` 中配置 `Toaster`）：

```tsx
import { toast } from "sonner";

toast.success("操作成功");
toast.error("登录失败", { description: "用户名或密码错误" });
```

---

## 6. 小程序开发规范（WeApp）

### 6.1 API 调用

通过同样的 `@yongstack/openapi-fetch` 客户端，但使用 `wxFetch` 适配器：

```ts
// apps/weapp/src/libs/index.ts
export const api = createClient<paths>({
  baseUrl: "https://your-api-server.com/api",
  fetch: wxFetch,    // 微信 wx.request 适配器
});
```

### 6.2 Cookie 持久化

通过中间件自动处理：

```ts
api.use({
  onRequest({ request }) {
    const savedCookies = wx.getStorageSync(COOKIE_STORAGE_KEY);
    if (savedCookies) {
      request.headers.set("Cookie", savedCookies.join("; "));
    }
    return request;
  },
  onResponse({ response }) {
    const wxRes = response as WxResponse;
    if (wxRes._wxCookies) {
      wx.setStorageSync(COOKIE_STORAGE_KEY, wxRes._wxCookies);
    }
    return response;
  },
});
```

### 6.3 wxFetch 适配器

`apps/weapp/src/libs/wxFetch.ts` 将微信 `wx.request` 包装为标准 `fetch` API，使 `openapi-fetch` 可以直接运行在小程序中。如果遇到请求问题，优先检查此适配器。

---

## 7. 类型共享与代码生成

### 工作流程

```
修改 API model.ts 或 service.ts
        │
        ▼
  重启 API 服务（或 watch 模式自动检测）
        │
        ▼
  API 的 /openapi/json 更新
        │
        ▼
  pnpm run gen → openapi-typescript 生成 schema.gen.d.ts
        │
        ▼
  前端代码获得最新类型
```

### 执行方式

```bash
# 手动生成
pnpm run gen

# 监听模式（自动重新生成）
pnpm run watch
```

### 类型使用场景

| 场景 | 引用方式 |
| --- | --- |
| API 调用 | `api.POST("/path", { body })` — 自动推导 |
| 引用 DTO 类型 | `components["schemas"]["User"]` |
| 引用路径类型 | `paths["/auth/login"]["post"]["requestBody"]` |

### 注意事项

> **OpenAPI 类型生成依赖于 API 正在运行。** 如果类型不更新，先确认 API 是否正常启动并能访问 `http://localhost:8080/openapi/json`。如果 API 端口不同，需要调整 `packages/openapi/watch.js` 或对应的生成脚本。

---

## 8. Git 规范

### 提交信息格式

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>: <简短描述>

<可选的详细描述>
```

允许的 types：

| type | 使用场景 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `refactor` | 重构（不修功能不改 bug） |
| `chore` | 杂项（依赖、配置等） |
| `docs` | 文档 |
| `style` | 代码风格（不影响逻辑） |
| `test` | 测试 |

示例：

```
feat: add phone login with SMS verification code
fix: handle 429 rate limit response in login form
refactor: extract form validation to shared utility
```

### Pre-commit 检查

- 提交时自动运行 Biome 格式化 + import 排序（lint-staged）
- 然后运行全量 typecheck
- 如果检查失败，提交被阻止，修复后重新 add + commit

### 禁止事项

- 不要提交 `node_modules/`、`dist/`、`.turbo/`
- 不要提交包含密钥或密码的文件
- 不要手动编辑 `routeTree.gen.ts`
- 不要修改已存在的迁移文件（增量生成新迁移）

---

## 9. 常见问题

### OpenAPI 类型未更新

```bash
# 1. 确认 API 已启动
curl http://localhost:8080/openapi/json

# 2. 重新生成
pnpm run gen
```

### 数据库连接失败

```bash
# 1. 确认 PostgreSQL 运行中
pg_isready

# 2. 确认 .env 中 DATABASE_URL 正确
#   格式：postgres://user:password@host:port/database

# 3. 测试连接
PGPASSWORD=<password> psql -h localhost -U <user> -d <database> -c "SELECT 1"
```

### 迁移冲突

如果多人修改了 schema 导致迁移冲突：

```bash
# 不要修改已有的迁移 SQL 文件
# 在解决 schema 冲突后，生成一条新迁移来对齐状态
bunx --bun drizzle-kit generate
```

### API 类型错误

如果 `api.POST()` 的路径参数类型报错，检查：

1. 是否更新了 OpenAPI 类型（运行 `pnpm run gen`）
2. 路径字符串是否完全匹配（注意大小写和前缀 `/`）
3. `body` 对象的字段名是否匹配 API 的 DTO 定义

---

> 这份指南基于代码库的现有约定提炼而成。随着项目演进，请及时更新本文档以反映新的最佳实践。
