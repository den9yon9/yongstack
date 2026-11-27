// 后台console准入权限: 拥有该权限即可登录管理端(仍需各路由的细粒度权限)
export const ADMIN_ACCESS_PERMISSION = 'admin:access' as const

export const DEFAULT_PERMISSIONS = [
  { code: ADMIN_ACCESS_PERMISSION, description: 'Access the admin console' },
  { code: 'users:read', description: 'Read users' },
  { code: 'users:write', description: 'Manage users' },
  { code: 'roles:read', description: 'Read roles' },
  { code: 'roles:write', description: 'Manage roles' },
  { code: 'settings:read', description: 'Read settings' },
  { code: 'settings:write', description: 'Manage settings' },
  { code: 'audit:read', description: 'Read audit logs' },
  { code: 'outbox:read', description: 'Read outbox events' },
  { code: 'outbox:write', description: 'Replay outbox events' },
  { code: 'queues:read', description: 'Read queue jobs and schedulers' },
  { code: 'queues:write', description: 'Retry, remove and schedule queue jobs' },
  { code: 'files:read:any', description: 'Read files across all users' },
  { code: 'files:write:any', description: 'Manage uploads across all users' },
  { code: 'files:delete:any', description: 'Delete files across all users' },
] as const

export type PermissionCode = (typeof DEFAULT_PERMISSIONS)[number]['code']

export const DEFAULT_ROLES = [
  {
    code: 'member',
    name: 'Member',
    description: 'Default member role',
    // 自有资源的读写删由"归属(owner)"隐式授权, 不需要权限码;
    // 权限码只表达"跨用户"能力(见 files:*:any), 避免 member 拿到越权语义。
    permissions: [] satisfies PermissionCode[],
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
