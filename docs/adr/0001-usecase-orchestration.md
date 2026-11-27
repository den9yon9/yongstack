# ADR 0001: usecase 之间的同步编排

- **状态**: Accepted（2026-11-27）
- **关联**: `AUD-05`
- **决策**: 采用方案 A —— 允许**单向无环**的 `usecase → usecase` 依赖；
  在此之前（没有真实流程时）保持现状，不引入无检查的互调。

## 背景

当前 `eslint-plugin-boundaries` 的 allow 列表里没有 `usecase`，所以 usecase 之间
是**隐式**禁止互相 import。同时 apps 层“不含业务编排”只是文档约定，lint 不拦。

真实缺口不是“没有合法位置”，而是“没有约定位置”：当一个同步流程需要组合两个用例时，
要么违规写进 controller，要么在新 usecase 里重写 domain 调用，要么绕过评审。

## 备选方案

| 方案          | 做法                                   | 结论                                             |
| ------------- | -------------------------------------- | ------------------------------------------------ |
| **A（采纳）** | 允许无环 `usecase → usecase`，加环检测 | 复杂度最低，符合 Clean Architecture 的“无环”约束 |
| B             | 新增 `usecases/flows/` 编排层，不碰 DB | 多一层目录与边界规则；当前流程复杂度不需要       |
| C             | 保持禁止，跨用例流程写进 controller    | 违反 thin controller，且无 lint 兜底             |

## 决策

- 目标模型是 A：usecase 可以调用另一个 usecase，但**依赖图必须无环**；
- **实施时机**：出现第一个真实的同步跨用例流程时（例如“管理员邀请用户”“下单”），
  在同一个 PR 里：
  1. 加 `dependency-cruiser` 环检测（或等价的自定义 lint 规则）；
  2. 迁移该真实流程作为范式；
  3. 更新 `CONTRIBUTE.md` 的分层说明（把“禁止互调”改成“禁止环”）；
- **在那之前**：现有边界规则保持不变，避免出现“规则没拦但已经在用”的灰区；
- apps 仍然只做装配与 HTTP 映射，顺序 `await` 多个 usecase 依旧不允许成为长期方案。

## 后果

- 正向：未来的同步跨用例流程有明确落点，不需要重写 domain 调用或污染 controller；
- 负向：需要维护环检测；usecase 之间的调用关系需要评审关注方向；
- 风险控制：环检测进 CI，且在迁移样例的同一个 PR 验证“故意写环会被拦住”。

## 触发条件

- 出现第一个需要同步组合两个 usecase 的业务流程；
- 或 usecase 数量增长到需要显式依赖图评审时。

## 参考

- Clean Architecture（依赖规则，无环）
- Modular Monolith（模块 public API / in-process events）
- Saga / Process Manager（长流程、需补偿时；本项目暂不需要）
