# 架构约束：lint 是护栏，不是保证

> 自定义 ESLint 规则（`eslint-rules/`）能在 CI 拦截大多数越界写法，
> 但 AST 规则天生是 best-effort。本文列出已知绕过路径和对应的人工检查点。

## 1. 规则覆盖什么

- 分层依赖方向（`eslint-plugin-boundaries` + `type-boundaries/no-infra-type-import`）
- 跨域读写（`table-ownership/no-cross-domain-tables`、`cross-domain-read/no-cross-domain-refs`）
- 事务入口（`transaction/use-with-transaction`）
- 错误码与不变量（`error-code/screaming-snake`、`invariant-throw/no-bare-throw`）
- i18n 标记纪律（`i18n/*`）
- 响应/入参白名单（`response-schema/allowlist`）

每条规则都有 RuleTester 用例（`pnpm test:rules`），但**用例证明规则按预期工作，不证明规则无法绕过**。

## 2. 已知绕过路径与人工检查点

| 绕过方式          | 例子                                               | 规则为什么漏                          | 人工检查点                                     |
| ----------------- | -------------------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| 别名导入          | `import { users as u } from '@yongstack/database'` | 规则只认 `schema.<name>` 的对象名     | 跨域写/读评审时确认 import 别名                |
| 原生 SQL          | `tx.execute(sql\`INSERT INTO orders ...\`)`        | 规则只看 Drizzle 方法调用             | 任何 `sql\`\``/`db.execute` 都要人工确认归属域 |
| 动态表名          | `schema['users']`、`const t = tables[name]`        | 只匹配静态 Identifier                 | 动态取表必须写明理由                           |
| 动态 import       | `await import('@yongstack/queue')`                 | boundaries 只看静态 ImportDeclaration | 新增动态 import 时人工确认目标层               |
| 模板字面量错误码  | ``err(`CODE`)``                                    | `error-code` 只查字符串 Literal       | 错误码必须是字面量；review 时搜 `err(\``       |
| 空参 i18n         | `i18n()`                                           | `marker-literal` 跳过无参调用         | 文案必须带英文源串                             |
| `detail` 豁免过宽 | 任意深度祖先属性名为 `detail` 都放行中文           | 规则只做祖先遍历                      | OpenAPI detail 以外的中文仍应使用 i18n         |
| 内联 type 导入    | `import { type Redis }`                            | 2026-11-27 已补（`type-boundaries`）  | 仍建议优先 `import type`                       |
| 事务别名          | `const tx = db; tx.transaction(fn)`                | 规则只看方法名 `.transaction`         | 新事务入口必须走 `withTransaction`             |

## 3. 运行时与测试兜底

lint 之外，关键路径还有：

- **DB 约束**：唯一索引、外键、`NOT NULL`、枚举；
- **事务语义**：`withTransaction` 把 `err()` 转为回滚；
- **集成测试**：`domains/*/src/service.test.ts` 真库验证 SQL/约束；
- **路由契约测试**：权限、状态码、cookie；
- **未来**：RLS / 运行时断言（引入多租户或更复杂授权时再评估）。

## 4. 评审时必须人工确认的场景

1. 跨域写（尤其 `tx.execute`、原生 SQL、动态表名）；
2. 权限判断：只查权限码，不查角色码；
3. 新事务入口：必须 `withTransaction`；
4. 用户可见文案：i18n 标记 + catalog 校验；
5. 上传/下载路径：CSP、bucket CORS、MIME/内容校验。

## 5. 维护规则

- 新增规则必须配 RuleTester（`pnpm test:rules` 在 `pnpm check` 与 CI 中执行）；
- 规则行为变化必须同步更新本文的绕过清单（如果原本的漏洞被补上）；
- 不要用“规则没报错”当作架构正确的证明。
