export const DEFAULT_PERMISSIONS = [
  { code: 'users:read', description: 'Read users' },
  { code: 'users:write', description: 'Manage users' },
  { code: 'roles:read', description: 'Read roles' },
  { code: 'roles:write', description: 'Manage roles' },
  { code: 'settings:read', description: 'Read settings' },
  { code: 'settings:write', description: 'Manage settings' },
  { code: 'audit:read', description: 'Read audit logs' },
  { code: 'outbox:read', description: 'Read outbox events' },
  { code: 'outbox:write', description: 'Replay outbox events' },
  { code: 'files:read', description: 'Read files' },
  { code: 'files:write', description: 'Upload files' },
  { code: 'files:delete', description: 'Delete files' },
] as const

export type PermissionCode = (typeof DEFAULT_PERMISSIONS)[number]['code']

export const DEFAULT_ROLES = [
  {
    code: 'member',
    name: 'Member',
    description: 'Default member role',
    permissions: ['files:read'] satisfies PermissionCode[],
  },
  {
    code: 'admin',
    name: 'Admin',
    description: 'Full access',
    permissions: DEFAULT_PERMISSIONS.map((permission) => permission.code),
  },
] as const

export type RoleCode = (typeof DEFAULT_ROLES)[number]['code']
export const DEFAULT_ROLE_CODE: RoleCode = 'member'
// 系统管理员角色码: admin-api 准入最低角色。会话域(isAdmin 守卫)由 apps 层传入本常量,
// packages 不持有业务字面量。
export const ADMIN_ROLE_CODE: RoleCode = 'admin'
