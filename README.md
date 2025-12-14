好的，我将根据你的项目结构和技术栈，为你撰写一份全面且规范化的项目文档。这份文档旨在成为新开发者的**操作手册**和团队的**开发规范指南**。

---

# 📚 Epinfresh 全栈 Monorepo 开发手册

本项目是一个基于 **Elysia.js (Bun)** 后端、**Drizzle ORM** 数据库层和 **Preact/微信小程序** 前端的全栈 TypeScript Monorepo。

## I. 🚀 快速上手 (Getting Started)

本节将引导你完成环境配置、依赖安装和项目启动。

### 1.1 前提条件 (Prerequisites)

| 要求 | 建议版本 | 说明 |
| :--- | :--- | :--- |
| **Runtime** | Bun v1.0+ | 用于高性能运行 Elysia API。 |
| **Package Manager** | pnpm v8+ | 用于管理 Monorepo 的依赖和 Workspace。 |
| **Database** | PostgreSQL | 需要一个正在运行的 PostgreSQL 实例。 |
| **Tool** | 微信开发者工具 | 运行 `apps/weapp` 必需。 |

### 1.2 环境配置与初始化

1.  **安装依赖**：在项目**根目录**下运行一次。

    ```bash
    pnpm install
    ```

2.  **配置环境变量**：
    复制 `apps/api/.env` 和 `packages/db/.env` 模板文件，并填写你的配置。
    *   **关键配置**：`DATABASE_URL`, `COOKIE_SECRET`, `WECHAT_MINIPROGRAM_APP_ID/SECRET`。

3.  **数据库迁移**：
    *   本模板使用 Drizzle ORM，假设已配置 `drizzle.config.ts` 中的 `migrate` 脚本。

    ```bash
    pnpm -F @epinfresh/db db:migrate
    ```

### 1.3 启动项目

#### 后端 API (http://localhost:8080)

```bash
# 启动 API 服务 (使用 Bun 运行 main.ts)
pnpm -F @epinfresh/api dev
```

#### Web 应用 (http://localhost:5173)

```bash
# 启动 Web 前端服务
pnpm -F www dev
```

#### 微信小程序 (`apps/weapp`)

```bash
# 1. 构建小程序代码
pnpm -F weapp dev

# 2. 打开微信开发者工具，导入项目，选择 apps/weapp/dist 目录作为项目根目录。
```

---

## II. 📐 架构与核心概念

本项目的核心在于 **端到端的类型安全** 和 **职责分离**。

### 2.1 Monorepo 结构总览

| 包/应用路径 | 职责 | 核心技术 |
| :--- | :--- | :--- |
| `packages/db` | 数据库 Schema & Model (SSOT) | Drizzle ORM, TypeBox |
| `packages/eden-preact-query` | 前端缓存与数据 Hook | Preact Hooks, Proxy |
| `apps/api` | 后端业务逻辑与认证 | Elysia.js, Bun |
| `apps/www` | Web 端 UI | Preact, Wouter, Suspense |
| `apps/weapp` | 微信小程序 UI | weapp-vite, 微信原生组件 |

### 2.2 端到端类型安全 (E2E Type Safety)

本项目使用 **Elysia.js + Eden Client** 实现完整的类型安全闭环：

1.  **数据定义:** `packages/db/schema` -> `packages/db/model.ts` 生成 TypeBox Schema。
2.  **API 校验:** `apps/api` 使用这些 TypeBox Schema 校验请求体/响应体。
3.  **类型导出:** `apps/api/main.ts` 导出 `App` 类型，包含所有路由和模型的准确类型信息。
4.  **客户端使用:** `Elysia Eden` 和 `createEdenHooks` 基于 `App` 类型在前端生成类型安全且带 Hooks 的 API 客户端。

---

## III. 🛠️ 后端 API 开发规范

### 3.1 模块化与分层

*   **`index.ts` (路由层)**: 仅负责路由定义、DTO 模型引用、Guard 引用和调用 Service 层函数。
*   **`model.ts` (模型层)**: 存放该模块特有的 DTOs，确保 Model 集中定义。
*   **`service.ts` (服务层)**:
    *   存放所有业务逻辑。
    *   **禁止** 访问 `Elysia Context` (如 `cookie`, `set`, `headers`)。
    *   可以访问 `db`。
    *   **错误处理：** 使用 `import { status } from 'elysia'` 在这里抛出 HTTP 状态码和错误信息。

### 3.2 认证与授权

*   **认证 (Authentication):** 基于 Cookie Session。登录成功后，**Service 层** 必须返回用户对象，由 **路由层** 负责设置 `cookie.userId.value = user.id.toString()`。
*   **授权 (Authorization):**
    *   所有需要登录的路由，必须使用 `app.use(isAuthenticated)`。
    *   认证通过后，`isAuthenticated` 会在 Context 中注入 `userId: number`。

```typescript
// apps/api/modules/user/index.ts 示例
.use(isAuthenticated)
.get("/mine", ({ userId }) => getMine(userId), {
    // ...
})
```

---

## IV. ⚛️ 前端数据层规范 (`eden-preact-query`)

### 4.1 核心原则：Hooks 优先

**禁止** 直接使用 `api.route.get.get()`，**必须** 使用通过 `createEdenHooks(api)` 封装的 `query` 对象。

```tsx
// ❌ 错误：不使用缓存
const { data: user } = await api.users(id).get();

// ✅ 正确：使用缓存和 Hook
const { data: user } = query.users(id).get.useQuery();
```

### 4.2 Query Key 规范

查询键 (QueryKey) 是缓存和去重的唯一标识。

*   Key 必须是一个稳定的、可序列化的数组，其中包含所有影响数据的参数。
*   **规则:** `[路径, 参数1, 参数2, HTTP方法]`

| 场景 | 推荐的 Query Key |
| :--- | :--- |
| 获取当前用户 | `['user', 'mine', 'get']` |
| 获取 ID 为 10 的用户 | `['users', 10, 'get']` |
| 获取所有帖子 | `['posts', 'get']` |

### 4.3 Hooks 用法约定

| Hook | 用途 | Loading 机制 | 错误机制 |
| :--- | :--- | :--- | :--- |
| **`useSuspenseQuery`** | 关键数据、页面级加载。 | **抛出 Promise**，由 `<Suspense>` 捕获。 | **抛出 Error**，由 `<ErrorBoundary>` 捕获。 |
| **`useQuery`** | 局部数据、需要手动控制 Loading 状态。 | **返回 `{ isLoading: boolean }`**。 | **返回 `{ isError: boolean, error: E }`**。 |

### 4.4 缓存控制

*   **`client.invalidate(key)`**: 在数据变动（如 POST/PUT/DELETE）后，用于清除对应 Read Query 的缓存，强制下次使用时重新获取。
*   **`client.clear()`**: **用于身份切换 (Login/Logout)**。在 `apps/www/src/pages/login/index.tsx` 中可以看到示例。

---

## V. 📱 应用特定指南

### 5.1 微信小程序 (`apps/weapp`)

*   **网络兼容性:** `src/lib/elysia-wx-polyfill.ts` 实现了微信 `wx.request` 到标准 `fetch` 的适配，并手动处理了 **Cookie** 存储。 **请勿随意修改此文件。**
*   **全局错误处理:** 微信小程序的 API 错误和脚本错误统一在 `src/app.ts` 的 `onUnhandledRejection` 和 `onError` 中处理。

### 5.2 Web 应用 (`apps/www`)

*   **Suspense 边界:** 所有使用 `useSuspenseQuery` 的组件必须被包裹在 `<Suspense>` 中。
*   **错误边界:** 顶层的 `<ErrorBoundary>` 捕获了所有路由和数据 Hook 抛出的错误，包括 401 Unauthorized，并引导用户进行登录或重试。

---

## VI. 🛡️ 工程化与质量保证

### 6.1 代码规范与格式化 (Biome)

本项目使用 `Biome` 作为唯一的代码格式化和 Linting 工具。

*   **执行:** `pnpm check`
*   **约定:**
    *   `pnpm install` 后，`husky` 会在 `pre-commit` 钩子中执行 `pnpm lint-staged`。
    *   所有暂存的文件都会被 Biome 自动修复和检查。

### 6.2 提交信息规范 (Commitlint)

提交信息必须遵循 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) 规范。

| Type | 说明 | 示例 |
| :--- | :--- | :--- |
| **`feat`** | 新功能 | `feat(api): add wechat login endpoint` |
| **`fix`** | Bug 修复 | `fix(weapp): fix cookie header polyfill issue` |
| **`refactor`** | 代码重构（不含功能变更） | `refactor(db): consolidate schema exports` |
| **`docs`** | 文档变更 | `docs: update quick start guide` |
| **`chore`** | 构建或辅助工具变更 | `chore(deps): update pnpm lockfile` |

### 6.3 类型检查

*   **执行:** `pnpm typecheck` (在项目根目录运行)
*   所有代码在提交前都会执行严格的类型检查，以确保 E2E 类型安全不被破坏。