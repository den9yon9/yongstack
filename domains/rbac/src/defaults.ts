export const DEFAULT_PERMISSIONS = [
  { code: 'users:read', description: 'Read users' },
  { code: 'users:write', description: 'Manage users' },
  { code: 'roles:read', description: 'Read roles' },
  { code: 'roles:write', description: 'Manage roles' },
  { code: 'settings:read', description: 'Read settings' },
  { code: 'settings:write', description: 'Manage settings' },
  { code: 'audit:read', description: 'Read audit logs' },
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
