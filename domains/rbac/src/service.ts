import { type DbClient, schema, withTransaction } from '@yongstack/database'
import { err, ok, type Result } from '@yongstack/shared'
import { and, eq, inArray } from 'drizzle-orm'

import { DEFAULT_PERMISSIONS, DEFAULT_ROLE_CODE, DEFAULT_ROLES, type RoleCode } from './defaults'

export type RbacError = 'ROLE_NOT_FOUND'

export interface UserAccess {
  roles: string[]
  permissions: string[]
}

export interface RoleWithPermissions {
  code: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: string[]
}

// 幂等初始化默认角色/权限; seed 与测试均可调用。
export async function ensureRbacDefaults(client: DbClient): Promise<void> {
  await withTransaction(client, async (tx) => {
    for (const permission of DEFAULT_PERMISSIONS) {
      await tx
        .insert(schema.permissions)
        .values({ code: permission.code, description: permission.description })
        .onConflictDoNothing({ target: schema.permissions.code })
    }

    for (const role of DEFAULT_ROLES) {
      await tx
        .insert(schema.roles)
        .values({
          code: role.code,
          name: role.name,
          description: role.description,
          isSystem: true,
        })
        .onConflictDoNothing({ target: schema.roles.code })
    }

    const roleRows = await tx.select().from(schema.roles)
    const permissionRows = await tx.select().from(schema.permissions)
    const roleByCode = new Map(roleRows.map((role) => [role.code, role]))
    const permissionByCode = new Map(
      permissionRows.map((permission) => [permission.code, permission]),
    )

    for (const role of DEFAULT_ROLES) {
      const roleRow = roleByCode.get(role.code)
      if (!roleRow) continue

      await tx.delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, roleRow.id))

      for (const permissionCode of role.permissions) {
        const permissionRow = permissionByCode.get(permissionCode)
        if (!permissionRow) continue
        await tx.insert(schema.rolePermissions).values({
          roleId: roleRow.id,
          permissionId: permissionRow.id,
        })
      }
    }

    return ok(undefined)
  })
}

export async function getUserAccess(userId: string, client: DbClient): Promise<UserAccess> {
  const roleRows = await client
    .select({ code: schema.roles.code })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(eq(schema.userRoles.userId, userId))

  const permissionRows = await client
    .selectDistinct({ code: schema.permissions.code })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .innerJoin(schema.rolePermissions, eq(schema.rolePermissions.roleId, schema.roles.id))
    .innerJoin(schema.permissions, eq(schema.permissions.id, schema.rolePermissions.permissionId))
    .where(eq(schema.userRoles.userId, userId))

  return {
    roles: roleRows.map((row) => row.code).sort(),
    permissions: permissionRows.map((row) => row.code).sort(),
  }
}

export async function assignDefaultRole(userId: string, client: DbClient): Promise<void> {
  const [role] = await client
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.code, DEFAULT_ROLE_CODE))
  if (!role) return
  await client.insert(schema.userRoles).values({ userId, roleId: role.id }).onConflictDoNothing()
}

export async function assignRoles(
  userId: string,
  roleCodes: string[],
  client: DbClient,
): Promise<Result<UserAccess, RbacError>> {
  const uniqueCodes = [...new Set(roleCodes)]
  if (uniqueCodes.length === 0) return err('ROLE_NOT_FOUND')

  const roleRows = await client
    .select()
    .from(schema.roles)
    .where(inArray(schema.roles.code, uniqueCodes))
  if (roleRows.length !== uniqueCodes.length) return err('ROLE_NOT_FOUND')

  return withTransaction(client, async (tx) => {
    await tx.delete(schema.userRoles).where(eq(schema.userRoles.userId, userId))
    await tx.insert(schema.userRoles).values(roleRows.map((role) => ({ userId, roleId: role.id })))
    return ok(await getUserAccess(userId, tx))
  })
}

export async function getRolesForUserIds(
  userIds: string[],
  client: DbClient,
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (userIds.length === 0) return map

  const rows = await client
    .select({ userId: schema.userRoles.userId, code: schema.roles.code })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(inArray(schema.userRoles.userId, userIds))

  for (const row of rows) {
    const codes = map.get(row.userId) ?? []
    codes.push(row.code)
    map.set(row.userId, codes)
  }
  for (const codes of map.values()) codes.sort()
  return map
}

export async function listRoles(client: DbClient): Promise<RoleWithPermissions[]> {
  const roleRows = await client.select().from(schema.roles)
  const permissionRows = await client
    .select({
      roleCode: schema.roles.code,
      permissionCode: schema.permissions.code,
    })
    .from(schema.rolePermissions)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.rolePermissions.roleId))
    .innerJoin(schema.permissions, eq(schema.permissions.id, schema.rolePermissions.permissionId))

  const permissionsByRole = new Map<string, string[]>()
  for (const row of permissionRows) {
    const list = permissionsByRole.get(row.roleCode) ?? []
    list.push(row.permissionCode)
    permissionsByRole.set(row.roleCode, list)
  }

  return roleRows
    .map((role) => ({
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: (permissionsByRole.get(role.code) ?? []).sort(),
    }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

export async function listPermissions(
  client: DbClient,
): Promise<{ code: string; description: string | null }[]> {
  const rows = await client.select().from(schema.permissions)
  return rows
    .map((row) => ({ code: row.code, description: row.description }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

export async function hasRoleCode(
  userId: string,
  roleCode: RoleCode,
  client: DbClient,
): Promise<boolean> {
  const [row] = await client
    .select({ userId: schema.userRoles.userId })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(and(eq(schema.userRoles.userId, userId), eq(schema.roles.code, roleCode)))
  return row !== undefined
}
