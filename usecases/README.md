# usecases

跨域编排目录。当前工程底座阶段为空，业务用例落地时按以下约定新增：

```
usecases/<name>/
  src/model.ts    TypeBox schema（用例输入/输出）
  src/service.ts  编排多个 domain，需要原子性时用 withTransaction
  src/index.ts    对外出口
  tsconfig.json
  package.json    @nestup/<name>
```

约束：

- 只有 usecase 能编排多个 domain。
- 需要原子性时用 `withTransaction(client, fn)`（`@nestup/database`），禁止直接 `.transaction(`。
- 只直写 `packages/database/src/schema/<usecase-name>/` 下的编排状态表；写业务域的表必须走该域 service。
- 返回 `Result`；新增错误码必须让入口控制器穷举处理。

详见仓库根目录 `CONTRIBUTE.md`。
