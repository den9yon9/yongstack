# @yongstack/openapi-fetch

基于 [openapi-ts/openapi-typescript](https://github.com/openapi-ts/openapi-typescript) 的 `openapi-fetch` 包改造，合并了 [PR #1970](https://github.com/openapi-ts/openapi-typescript/pull/1970)（status 类型收窄），并内联了 `openapi-typescript-helpers` 的类型依赖。使用方式与原版一致，完整文档见 [openapi-fetch 官方文档](https://openapi-ts.dev/openapi-fetch/)。

## 与原版的区别

### 1. 新增 `status` 属性，支持基于状态码收窄类型

原版 `FetchResponse` 只能通过 `data` / `error` 做粗略收窄：

```typescript
// 原版
const { data, error } = await client.GET("/resources");
if (data) { /* data: Resource[] */ }
if (error) { /* error: Error */ }
```

当前版本额外支持按具体 HTTP 状态码收窄：

```typescript
const result = await client.GET("/resources");

if (result.status === 200) {
  result.data  // Resource[]
  result.error // never
}
if (result.status === 500) {
  result.data  // never
  result.error // Error
}
// schema 中未定义的状态码会触发类型错误
if (result.status === 403) {
  // typescript error: 403 is not assignable
}
```

### 2. 类型依赖内联

原版从 `openapi-typescript-helpers` 导入类型。当前版本将所有用到的类型定义在 `src/internal.ts` 中，无需额外安装 helpers 包。

### 3. 精简配置

移除了测试、示例、lint 脚本、changeset 等 monorepo 相关文件，仅保留构建和类型检查所需的最小配置。

## LICENSE

MIT — 原始协议源自 [openapi-ts/openapi-typescript](https://github.com/openapi-ts/openapi-typescript)
