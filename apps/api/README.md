***

# YongStack API 服务开发与架构规范

本项目是基于 [Elysia.js](https://elysiajs.com/) 和 Bun 构建的高性能、端到端类型安全后端服务。为了保证团队协作的高效和代码的可维护性，我们在业务模块的组织上采用了**按领域划分 (Feature-Module)** 的三层架构。

请所有开发者在提交代码前，确保符合以下开发规范。

---

## 📚 目录

1. [项目结构](#1-项目结构)
2. [三层架构职责边界](#2-三层架构职责边界)
3. [数据与模型规范 (Model)](#3-数据与模型规范-model)
4. [错误与异常处理规范](#4-错误与异常处理规范)
5. [数据库与跨模块调用](#5-数据库与跨模块调用)

---

## 1. 项目结构

后端代码集中在 `apps/api` 目录下，业务逻辑按**功能领域**进行拆分，存放在 `modules` 文件夹中。每个业务模块必须包含固定的三个文件：

```text
apps/api/
├── lib/                 # 核心基础设施 (db, env, 全局中间件/守卫等)
├── modules/             # 业务模块目录
│   ├── auth/            # 例如：认证模块
│   │   ├── index.ts     # Controller层 (定义路由、组装依赖)
│   │   ├── model.ts     # Model层 (定义入参出参 DTO 校验规则)
│   │   └── service.ts   # Service层 (纯粹的业务逻辑与数据库操作)
│   └── user/            # 例如：用户模块
└── main.ts              # 应用入口，注册所有模块
```

---

## 2. 三层架构职责边界

为了保证代码的可测试性和低耦合，我们严格划分了 `Controller` 和 `Service` 的边界。

### Controller 层 (`index.ts`)
* **主要职责**：定义路由路径、挂载校验模型、解析 HTTP 上下文（提取 body, query, cookie）、将数据传递给 Service 并处理返回结果。
* **严格禁令**：**绝对禁止**在 Controller 中直接写 `db.query` 或 `db.insert` 操作数据库。
* **严格禁令**：**禁止**在 Controller 的路由定义里临时写内联的 `t.Object(...)` 校验结构，必须从 `model.ts` 引入。

### Service 层 (`service.ts`)
* **主要职责**：承载核心业务逻辑，负责与数据库交互。
* **边界约束**：Service 必须是**纯粹的 TypeScript 函数**。它完全不知道 HTTP 的存在，**绝不能**接收 Elysia 的 `Context`（如 `set`, `cookie`, `request`）。需要的数据必须由 Controller 提取后作为普通参数传入。

**✅ 正确示范：**
```typescript
// service.ts (纯粹逻辑)
export async function updateAvatar(userId: number, avatarUrl: string) {
  return await db.update(schema.user).set({ avatarUrl }).where(eq(schema.user.id, userId)).returning();
}

// index.ts (HTTP 处理)
app.put('/avatar', async ({ cookie, body }) => {
  // Controller 负责操作 cookie 和 body，Service 只接收具体的变量
  const userId = Number(cookie.userId.value);
  return await updateAvatar(userId, body.avatarUrl);
}, { body: "UpdateAvatarDTO" }); // 引用挂载的 Model
```

---

## 3. 数据与模型规范 (Model)

本项目完全抛弃了传统的自建 DTO 类，统一使用 TypeBox (`t`) 和 `drizzle-typebox` 来做类型校验与 OpenAPI 生成。

* **集中管理**：所有的 API 入参、出参数据结构，**必须且只能**写在当前模块的 `model.ts` 里。
* **必须注册**：定义好的结构必须挂载到 `new Elysia().model()` 上，暴露给 Controller 使用以保持路由文件的干净。

**✅ 正确示范：**
```typescript
// model.ts
import Elysia, { t } from "elysia";

export const orderModel = new Elysia().model({
  CreateOrderDTO: t.Object({
    productId: t.Number(),
    amount: t.Number(),
  }),
  OrderResponse: t.Object({
    orderId: t.String(),
    status: t.String()
  })
});

// index.ts
import { orderModel } from "./model";

export const order = new Elysia({ prefix: "/order" })
  .use(orderModel) // 先挂载
  .post("/", ({ body }) => createOrder(body), {
    body: "CreateOrderDTO",       // 通过字符串引用
    response: "OrderResponse"
  });
```

---

## 4. 错误与异常处理规范

本项目采用原生的 HTTP 状态码来传达结果，**不包裹**统一的 `{code, data, message}` 结构。

对于错误处理，我们将其分为两类，并采用了**“抛出与返回分离”**的极客做法，以配合 OpenAPI 的类型推导系统：

### 第一类：常规错误（无需前端特殊处理）
这类错误前端只需要弹出 Toast 提示用户即可（如：用户不存在、密码错误）。
* **处理方式**：直接在 **Service 层** 中 `throw status(HttpCode, "错误信息")`。
* **原理**：全局的拦截器会捕获 `throw` 的异常并返回对应状态码，前端统一拦截展示。

```typescript
// service.ts
import { status } from "elysia";

export async function getUser(id: number) {
  const user = await db.query.user.findFirst(...);
  if (!user) {
    // 💡 第一类错误：直接抛出，中断执行
    throw status(404, "该用户不存在");
  }
  return user;
}
```

### 第二类：业务分支错误（需要前端感知并跳转或弹窗）
这类错误需要在前端做具体的业务分支处理（如：余额不足需引导充值、账号被风控需跳转人脸验证）。
* **处理方式**：由 Service 抛出特定标记或返回特定状态，然后在 **Controller 层** 中使用 `return status(HttpCode, "错误信息")` 进行返回。
* **原理**：在 Controller 中 `return status(...)` 会让 Elysia 将该 HTTP 错误状态精确地写入 OpenAPI 的 JSON 规范中。前端通过 `openapi-fetch` 能够感知到这个特定的错误类型，从而在 TS 层面白盒化处理该业务分支。

```typescript
// index.ts
export const pay = new Elysia()
  .post("/checkout", async ({ body }) => {
    const isEnough = await checkBalance(body.amount);

    if (!isEnough) {
      // 💡 第二类错误：在 Controller 中 explicitly return
      // 这样 OpenAPI 就能推导出此接口可能返回 402 错误，前端在调用时会得到类型提示
      return status(402, "余额不足，请前往充值");
    }

    return await processPayment(body.amount);
  });
```

---

## 5. 数据库与跨模块调用

### 数据库操作边界
1. 所有与数据库引擎的直接交互代码（引入 `db`, `schema`, `eq` 等 Drizzle API）**只允许**出现在 `service.ts` 中。
2. 尽量复用 `@yongstack/db` 中生成的类型，而不是自己手写接口类型。

### 跨模块调用原则（实用主义）
在模块与模块之间（例如 `order` 模块需要查询 `user` 数据）：
* **允许**直接引入其他模块的 `service.ts` 函数进行调用。
* 但**禁止**引入其他模块的 `index.ts`（Controller）逻辑。
* 只要保持 Service 层纯粹（不依赖 Http Context），互相调用不仅方便，而且能最大化复用代码。

```typescript
// modules/order/service.ts
import { getUserInfo } from "../user/service"; // ✅ 允许跨模块调用 Service

export async function createOrder(userId: number) {
  const user = await getUserInfo(userId);
  // ...
}
```
