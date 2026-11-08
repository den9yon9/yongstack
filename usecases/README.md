# usecases

跨域编排目录。当前工程底座阶段为空，业务用例落地时按以下约定新增：

```
usecases/<name>/
  src/model.ts    TypeBox schema（用例输入/输出）
  src/service.ts  编排多个 domain，需要原子性时用 withTransaction
  src/index.ts    对外出口
  tsconfig.json
  package.json    @yongstack/<name>
```

约束：

- 只有 usecase 能编排多个 domain。
- 需要原子性时用 `withTransaction(client, fn)`（`@yongstack/database`），禁止直接 `.transaction(`。
- 只直写 `packages/database/src/schema/<usecase-name>/` 下的编排状态表；写业务域的表必须走该域 service。
- 返回 `Result`；新增错误码必须让入口控制器穷举处理。
- 外部副作用（队列/存储等基础设施）只经本层定义的端口接口使用，实现由 apps/worker 注入；
  禁止 import `infrastructure` 包（`@yongstack/{queue,session,redis,http,storage,mailer,sms}`，
  含 `import type`，ESLint `type-boundaries/no-infra-type-import` 强制）。

详见仓库根目录 `CONTRIBUTE.md`。
