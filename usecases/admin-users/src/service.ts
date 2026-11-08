import type { Static } from '@sinclair/typebox'
import { type DbClient, withTransaction } from '@yongstack/database'
import { assignRoles, getRolesForUserIds, getUserAccess, type UserAccess } from '@yongstack/rbac'
import { err, ok, type Result } from '@yongstack/shared'
import { getUserById, listUsers, updateUserStatus, type UserError } from '@yongstack/user'
import type { UpdateUserAccessInputSchema, UserListQuerySchema } from '@yongstack/user/model'

export type AdminUserError = 'SELF_OPERATION' | 'ROLE_NOT_FOUND' | UserError

export interface AdminUser extends UserAccess {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  avatar: string | null
  locale: string
  emailVerifiedAt: Date | null
  phoneVerifiedAt: Date | null
  lastLoginAt: Date | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export async function listUsersWithRoles(
  query: Static<typeof UserListQuerySchema>,
  client: DbClient,
) {
  const page = await listUsers(query, client)
  const rolesByUser = await getRolesForUserIds(
    page.items.map((user) => user.id),
    client,
  )
  return {
    ...page,
    items: page.items.map((user) => ({
      ...user,
      roles: rolesByUser.get(user.id) ?? [],
    })),
  }
}

export async function getUserWithRoles(
  id: string,
  client: DbClient,
): Promise<Result<AdminUser, UserError>> {
  const found = await getUserById(id, client)
  if (found.isErr()) return err(found.error)
  const access = await getUserAccess(id, client)
  return ok({ ...found.value, ...access })
}

export async function updateUserAccess(
  id: string,
  input: Static<typeof UpdateUserAccessInputSchema>,
  actorId: string,
  client: DbClient,
): Promise<Result<AdminUser, AdminUserError>> {
  if (id === actorId) return err('SELF_OPERATION')

  return withTransaction(client, async (tx) => {
    if (input.roles !== undefined) {
      const assigned = await assignRoles(id, input.roles, tx)
      if (assigned.isErr()) return err(assigned.error)
    }

    if (input.isActive !== undefined) {
      const status = await updateUserStatus(id, { isActive: input.isActive }, tx)
      if (status.isErr()) return err(status.error)
    }

    const found = await getUserById(id, tx)
    if (found.isErr()) return err(found.error)
    const access = await getUserAccess(id, tx)
    return ok({ ...found.value, ...access })
  })
}
