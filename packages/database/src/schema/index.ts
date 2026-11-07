// 表定义按域分目录; 目录名即表归属域(eslint-rules/table-ownership.js 据此推导)。
// 新增表: 放到对应域目录 + 在此补一行导出即可, 归属自动成立。
// 顶层导出仍保持扁平命名(所有表聚合在 schema 命名空间), 使用方无感知。

// file 域(文件元数据与通用附件关联)
export { fileAttachments } from './file/file-attachments'
export { files } from './file/files'
// outbox 域(领域事件持久化, 事务内写入, worker 异步投递)
export {
  OUTBOX_EVENT_STATUS,
  outboxEvents,
  type OutboxEventStatus,
  outboxEventStatus,
} from './outbox/outbox-events'
// rbac 域(角色/权限/用户角色)
export { permissions } from './rbac/permissions'
export { rolePermissions } from './rbac/role-permissions'
export { roles } from './rbac/roles'
export { userRoles } from './rbac/user-roles'
// settings 域(运行时配置与功能开关)
export { settings } from './settings/settings'
// user 域(身份底座)
export { emailVerificationTokens } from './user/email-verification-tokens'
export { passwordResetTokens } from './user/password-reset-tokens'
export { users } from './user/users'
