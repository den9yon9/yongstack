import { type DbClient, schema, withTransaction } from '@yongstack/database'
import { err, ok, type Result } from '@yongstack/shared'
import { and, count, eq, inArray } from 'drizzle-orm'

import { DEFAULT_PERMISSIONS, DEFAULT_ROLE_CODE, DEFAULT_ROLES, type RoleCode } from './defaults'

export type RbacError =
  | 'ROLE_NOT_FOUND'
  | 'ROLE_CODE_EXISTS'
  | 'SYSTEM_ROLE_READONLY'
  | 'ROLE_IN_USE'
  | 'PERMISSION_NOT_FOUND'

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

      // 非破坏性同步: 只补缺失的默认权限, 不删除自定义添加的权限。
      // 默认角色权限视为"最低集合"; 需要永久移除默认权限时再引入 roles.isCustomized。
      for (const permissionCode of role.permissions) {
        const permissionRow = permissionByCode.get(permissionCode)
        if (!permissionRow) continue
        await tx
          .insert(schema.rolePermissions)
          .values({ roleId: roleRow.id, permissionId: permissionRow.id })
          .onConflictDoNothing()
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

export type RoleAssignmentError = 'ROLE_NOT_FOUND'

export async function assignRoles(
  userId: string,
  roleCodes: string[],
  client: DbClient,
): Promise<Result<UserAccess, RoleAssignmentError>> {
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

async function getRoleWithPermissions(
  code: string,
  client: DbClient,
): Promise<RoleWithPermissions | null> {
  const [role] = await client.select().from(schema.roles).where(eq(schema.roles.code, code))
  if (!role) return null
  const permissionRows = await client
    .select({ code: schema.permissions.code })
    .from(schema.rolePermissions)
    .innerJoin(schema.permissions, eq(schema.permissions.id, schema.rolePermissions.permissionId))
    .where(eq(schema.rolePermissions.roleId, role.id))
  return {
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: permissionRows.map((row) => row.code).sort(),
  }
}

async function replacePermissions(
  roleId: string,
  permissionCodes: string[],
  client: DbClient,
): Promise<Result<void, 'PERMISSION_NOT_FOUND'>> {
  const unique = [...new Set(permissionCodes)]
  if (unique.length > 0) {
    const rows = await client
      .select({ id: schema.permissions.id, code: schema.permissions.code })
      .from(schema.permissions)
      .where(inArray(schema.permissions.code, unique))
    if (rows.length !== unique.length) return err('PERMISSION_NOT_FOUND')
    await client.delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, roleId))
    await client
      .insert(schema.rolePermissions)
      .values(rows.map((row) => ({ roleId, permissionId: row.id })))
    return ok(undefined)
  }
  await client.delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, roleId))
  return ok(undefined)
}

export interface CreateRoleInput {
  code: string
  name: string
  description?: string | null
  permissions?: string[]
}

export async function createRole(
  input: CreateRoleInput,
  client: DbClient,
): Promise<Result<RoleWithPermissions, RbacError>> {
  return withTransaction(client, async (tx) => {
    const [existing] = await tx
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, input.code))
    if (existing) return err('ROLE_CODE_EXISTS')

    const [role] = await tx
      .insert(schema.roles)
      .values({
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        isSystem: false,
      })
      .returning()

    const result = await replacePermissions(role.id, input.permissions ?? [], tx)
    if (result.isErr()) return err(result.error)
    const created = await getRoleWithPermissions(input.code, tx)
    if (!created) return err('ROLE_NOT_FOUND')
    return ok(created)
  })
}

export interface UpdateRoleInput {
  name?: string
  description?: string | null
}

export async function updateRole(
  code: string,
  input: UpdateRoleInput,
  client: DbClient,
): Promise<Result<RoleWithPermissions, RbacError>> {
  return withTransaction(client, async (tx) => {
    const [role] = await tx.select().from(schema.roles).where(eq(schema.roles.code, code))
    if (!role) return err('ROLE_NOT_FOUND')
    if (role.isSystem) return err('SYSTEM_ROLE_READONLY')

    await tx
      .update(schema.roles)
      .set({
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
      })
      .where(eq(schema.roles.id, role.id))

    const updated = await getRoleWithPermissions(code, tx)
    if (!updated) return err('ROLE_NOT_FOUND')
    return ok(updated)
  })
}

export async function setRolePermissions(
  code: string,
  permissionCodes: string[],
  client: DbClient,
): Promise<Result<RoleWithPermissions, RbacError>> {
  return withTransaction(client, async (tx) => {
    const [role] = await tx.select().from(schema.roles).where(eq(schema.roles.code, code))
    if (!role) return err('ROLE_NOT_FOUND')
    if (role.isSystem) return err('SYSTEM_ROLE_READONLY')

    const result = await replacePermissions(role.id, permissionCodes, tx)
    if (result.isErr()) return err(result.error)
    const updated = await getRoleWithPermissions(code, tx)
    if (!updated) return err('ROLE_NOT_FOUND')
    return ok(updated)
  })
}

export async function deleteRole(code: string, client: DbClient): Promise<Result<void, RbacError>> {
  return withTransaction(client, async (tx) => {
    const [role] = await tx.select().from(schema.roles).where(eq(schema.roles.code, code))
    if (!role) return err('ROLE_NOT_FOUND')
    if (role.isSystem) return err('SYSTEM_ROLE_READONLY')

    const [{ total }] = await tx
      .select({ total: count() })
      .from(schema.userRoles)
      .where(eq(schema.userRoles.roleId, role.id))
    if (Number(total) > 0) return err('ROLE_IN_USE')

    await tx.delete(schema.roles).where(eq(schema.roles.id, role.id))
    return ok(undefined)
  })
}

export async function listUserIdsByRole(code: string, client: DbClient): Promise<string[]> {
  const rows = await client
    .select({ userId: schema.userRoles.userId })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(eq(schema.roles.code, code))
  return rows.map((row) => row.userId)
}
