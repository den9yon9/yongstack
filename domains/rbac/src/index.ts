export {
  ADMIN_ROLE_CODE,
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLE_CODE,
  DEFAULT_ROLES,
  type PermissionCode,
  type RoleCode,
} from './defaults'
export {
  assignDefaultRole,
  assignRoles,
  ensureRbacDefaults,
  getRolesForUserIds,
  getUserAccess,
  hasRoleCode,
  listPermissions,
  listRoles,
  type RbacError,
  type RoleWithPermissions,
  type UserAccess,
} from './service'
