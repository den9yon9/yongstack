# domains

实体域目录。当前工程底座阶段为空，业务域落地时按以下约定新增：

```
domains/<name>/
  src/model.ts    TypeBox schema（从 packages/database 派生）
  src/service.ts  纯业务函数（neverthrow Result，依赖 DbClient 注入）
  src/index.ts    对外出口（只导出函数与类型）
  tsconfig.json
  package.json    @nestup/<name>
```

约束：

- 域之间禁止互调；跨域编排放到 `usecases/`。
- 只读写本域的表（ESLint `table-ownership` / `cross-domain-read`）。
- 不得 import Elysia、session、http、redis、storage；需要这些能力时通过参数注入或在 `apps/` 层接线。
- 错误码使用 SCREAMING_SNAKE 字符串，新增错误码必须让控制器穷举处理（编译期强制）。

详见仓库根目录 `CONTRIBUTE.md`。
