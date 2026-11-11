import { type RecordAuditInput, withAudit } from '@yongstack/audit'
import type { DbClient } from '@yongstack/database'
import {
  createRole,
  type CreateRoleInput,
  deleteRole,
  listUserIdsByRole,
  type RbacError,
  type RoleWithPermissions,
  setRolePermissions,
  updateRole,
  type UpdateRoleInput,
} from '@yongstack/rbac'
import { err, ok, type Result } from '@yongstack/shared'

export type AdminRoleError = RbacError
export type { CreateRoleInput, UpdateRoleInput }

// 审计上下文由 apps 层从 requestMeta 注入(IP/UA/requestId)
export type AuditMeta = Pick<RecordAuditInput, 'ip' | 'userAgent' | 'requestId'>

export interface RoleChangeResult {
  role: RoleWithPermissions
  // 权限变更后需要撤销会话的用户; apps 层逐个 destroyAllForUser
  affectedUserIds: string[]
}

export async function createRoleWithAudit(
  input: CreateRoleInput,
  actorId: string,
  client: DbClient,
  meta: AuditMeta = {},
): Promise<Result<RoleWithPermissions, AdminRoleError>> {
  return withAudit(
    client,
    {
      actorId,
      action: 'admin.role.create',
      targetType: 'role',
      targetId: input.code,
      diff: { patch: input },
      ...meta,
    },
    (tx) => createRole(input, tx),
  )
}

export async function updateRoleWithAudit(
  code: string,
  input: UpdateRoleInput,
  actorId: string,
  client: DbClient,
  meta: AuditMeta = {},
): Promise<Result<RoleWithPermissions, AdminRoleError>> {
  return withAudit(
    client,
    {
      actorId,
      action: 'admin.role.update',
      targetType: 'role',
      targetId: code,
      diff: { patch: input },
      ...meta,
    },
    (tx) => updateRole(code, input, tx),
  )
}

export async function setRolePermissionsWithAudit(
  code: string,
  permissions: string[],
  actorId: string,
  client: DbClient,
  meta: AuditMeta = {},
): Promise<Result<RoleChangeResult, AdminRoleError>> {
  return withAudit(
    client,
    {
      actorId,
      action: 'admin.role.permissions.update',
      targetType: 'role',
      targetId: code,
      diff: { permissions },
      ...meta,
    },
    async (tx) => {
      const updated = await setRolePermissions(code, permissions, tx)
      if (updated.isErr()) return err(updated.error)
      const affectedUserIds = await listUserIdsByRole(code, tx)
      return ok({ role: updated.value, affectedUserIds })
    },
  )
}

export async function deleteRoleWithAudit(
  code: string,
  actorId: string,
  client: DbClient,
  meta: AuditMeta = {},
): Promise<Result<{ affectedUserIds: string[] }, AdminRoleError>> {
  return withAudit(
    client,
    {
      actorId,
      action: 'admin.role.delete',
      targetType: 'role',
      targetId: code,
      ...meta,
    },
    async (tx) => {
      const affectedUserIds = await listUserIdsByRole(code, tx)
      const deleted = await deleteRole(code, tx)
      if (deleted.isErr()) return err(deleted.error)
      return ok({ affectedUserIds })
    },
  )
}
