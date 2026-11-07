// 表定义按域分目录; 目录名即表归属域(eslint-rules/table-ownership.js 据此推导)。
// 新增表: 放到对应域目录 + 在此补一行导出即可, 归属自动成立。
// 顶层导出仍保持扁平命名(所有表聚合在 schema 命名空间), 使用方无感知。

// outbox 域(领域事件持久化, 事务内写入, worker 异步投递)
export {
  OUTBOX_EVENT_STATUS,
  outboxEvents,
  type OutboxEventStatus,
  outboxEventStatus,
} from './outbox/outbox-events'
// user 域(身份底座; 登录/注册等业务能力后续在 domains/user 实现)
export { userRole, users } from './user/users'
