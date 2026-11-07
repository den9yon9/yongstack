// 表定义按域分目录; 目录名即表归属域(eslint-rules/table-ownership.js 据此推导)。
// 新增表: 放到对应域目录 + 在此补一行导出即可, 归属自动成立。
// 顶层导出仍保持扁平命名(所有表聚合在 schema 命名空间), 使用方无感知。

// user 域(身份底座; 登录/注册等业务能力后续在 domains/user 实现)
export { userRole, users } from './user/users'
