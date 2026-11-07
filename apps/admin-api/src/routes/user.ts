import { Type } from '@sinclair/typebox'
import { getUserWithRoles, listUsersWithRoles, updateUserAccess } from '@yongstack/admin-users'
import { listPermissions, listRoles } from '@yongstack/rbac'
import { hasPermission } from '@yongstack/session'
import { assertNever, ErrorResponse } from '@yongstack/shared'
import * as UserModel from '@yongstack/user/model'
import { Elysia, status } from 'elysia'

import { type AdminPlugins } from '../plugins'

const RoleSchema = Type.Object({
  code: Type.String(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  isSystem: Type.Boolean(),
  permissions: Type.Array(Type.String()),
})

const RoleListResponseSchema = Type.Object({ items: Type.Array(RoleSchema) })

const PermissionListResponseSchema = Type.Object({
  items: Type.Array(
    Type.Object({
      code: Type.String(),
      description: Type.Union([Type.String(), Type.Null()]),
    }),
  ),
})

export function createUserRoutes(plugins: AdminPlugins) {
  return new Elysia({ name: 'user-admin', prefix: '/admin' })
    .use(plugins.localePlugin)
    .use(plugins.dbPlugin)
    .use(plugins.sessionPlugin)
    .get(
      '/users',
      async ({ query, session, db, i18n }) => {
        if (!hasPermission(session, 'users:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        return listUsersWithRoles(query, db)
      },
      {
        isAdmin: true,
        query: UserModel.UserListQuerySchema,
        response: {
          200: UserModel.UserListResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Users'],
          summary: '用户列表',
          description:
            '分页用户列表，支持关键词与启用状态筛选。\n\n- 需要 admin 角色与 users:read 权限',
        },
      },
    )
    .get(
      '/users/:id',
      async ({ params, session, db, i18n }) => {
        if (!hasPermission(session, 'users:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const result = await getUserWithRoles(params.id, db)
        if (result.isErr()) {
          switch (result.error) {
            case 'USER_NOT_FOUND':
              return status(404, { error: result.error, message: i18n('User not found') })
            default:
              return assertNever(result.error)
          }
        }
        return result.value
      },
      {
        isAdmin: true,
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: {
          200: UserModel.AuthUserResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Users'],
          summary: '用户详情',
          description: '按 ID 获取用户信息、角色与权限。\n\n- 需要 users:read 权限',
        },
      },
    )
    .patch(
      '/users/:id',
      async ({ params, body, session, db, sessionStore, i18n }) => {
        if (!hasPermission(session, 'users:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const result = await updateUserAccess(params.id, body, session.userId, db)
        if (result.isErr()) {
          switch (result.error) {
            case 'SELF_OPERATION':
              return status(400, {
                error: result.error,
                message: i18n('Cannot modify your own account'),
              })
            case 'ROLE_NOT_FOUND':
              return status(400, {
                error: result.error,
                message: i18n('Role not found'),
              })
            case 'USER_NOT_FOUND':
              return status(404, { error: result.error, message: i18n('User not found') })
            default:
              return assertNever(result.error)
          }
        }

        // 角色/状态变更后旧会话权限立即失效
        await sessionStore.destroyAllForUser(params.id)
        return result.value
      },
      {
        isAdmin: true,
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: UserModel.UpdateUserAccessInputSchema,
        response: {
          200: UserModel.AuthUserResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Users'],
          summary: '更新用户角色/状态',
          description:
            '分配角色或启用/禁用用户，成功后撤销该用户全部会话。\n\n- 需要 users:write 权限\n- 禁止修改自己的账号',
        },
      },
    )
    .delete(
      '/users/:id/sessions',
      async ({ params, session, sessionStore, i18n }) => {
        if (!hasPermission(session, 'users:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        if (params.id === session.userId) {
          return status(400, {
            error: 'SELF_OPERATION',
            message: i18n('Cannot modify your own account'),
          })
        }
        await sessionStore.destroyAllForUser(params.id)
        return status(204)
      },
      {
        isAdmin: true,
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        detail: {
          tags: ['Admin/Users'],
          summary: '撤销用户全部会话',
          description: '踢出指定用户的全部设备。\n\n- 需要 users:write 权限',
        },
      },
    )
    .get(
      '/roles',
      async ({ session, db, i18n }) => {
        if (!hasPermission(session, 'roles:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        return { items: await listRoles(db) }
      },
      {
        isAdmin: true,
        response: {
          200: RoleListResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Roles'],
          summary: '角色列表',
          description: '角色及其权限集合。\n\n- 需要 roles:read 权限',
        },
      },
    )
    .get(
      '/permissions',
      async ({ session, db, i18n }) => {
        if (!hasPermission(session, 'roles:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        return { items: await listPermissions(db) }
      },
      {
        isAdmin: true,
        response: {
          200: PermissionListResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Roles'],
          summary: '权限列表',
          description: '全部权限码。\n\n- 需要 roles:read 权限',
        },
      },
    )
}
