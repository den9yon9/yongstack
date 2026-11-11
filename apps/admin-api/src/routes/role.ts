import {
  type AdminRoleError,
  createRoleWithAudit,
  deleteRoleWithAudit,
  setRolePermissionsWithAudit,
  updateRoleWithAudit,
} from '@yongstack/admin-roles'
import { type RoleWithPermissions } from '@yongstack/rbac'
import {
  CreateRoleInputSchema,
  SetRolePermissionsInputSchema,
  UpdateRoleInputSchema,
} from '@yongstack/rbac/model'
import { hasPermission } from '@yongstack/session'
import { assertNever, ErrorResponse, requestMeta } from '@yongstack/shared'
import { Elysia, status, t } from 'elysia'

import { type AdminPlugins } from '../plugins'

const RoleCodeParams = t.Object({
  code: t.String({ pattern: '^[a-z][a-z0-9_-]{1,63}$' }),
})

const RoleResponseSchema = t.Object({
  code: t.String(),
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  isSystem: t.Boolean(),
  permissions: t.Array(t.String()),
})

function toRoleResponse(role: RoleWithPermissions) {
  return {
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.permissions,
  }
}

function mapError(error: AdminRoleError, i18n: (text: string) => string) {
  switch (error) {
    case 'ROLE_NOT_FOUND':
      return status(404, { error, message: i18n('Role not found') })
    case 'ROLE_CODE_EXISTS':
      return status(409, { error, message: i18n('Role code already exists') })
    case 'SYSTEM_ROLE_READONLY':
      return status(409, { error, message: i18n('System role is read-only') })
    case 'ROLE_IN_USE':
      return status(409, { error, message: i18n('Role is in use') })
    case 'PERMISSION_NOT_FOUND':
      return status(400, { error, message: i18n('Permission not found') })
    default:
      return assertNever(error)
  }
}

export function createRoleRoutes(plugins: AdminPlugins) {
  const { apiRateLimitPerMinute } = plugins

  return new Elysia({ name: 'role-admin', prefix: '/admin' })
    .use(plugins.localePlugin)
    .use(plugins.dbPlugin)
    .use(plugins.sessionPlugin)
    .use(plugins.apiRateLimit)
    .post(
      '/roles',
      async ({ body, session, db, request, i18n }) => {
        if (!hasPermission(session, 'roles:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const result = await createRoleWithAudit(
          body,
          session.userId,
          db,
          requestMeta(request, { trustProxy: plugins.trustProxy }),
        )
        if (result.isErr()) return mapError(result.error, i18n)
        return status(201, toRoleResponse(result.value))
      },
      {
        isAdmin: true,
        body: CreateRoleInputSchema,
        response: {
          201: RoleResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          409: ErrorResponse,
          429: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Admin/Roles'],
          summary: '创建角色',
          description: '创建自定义角色并可选分配权限。\n\n- 需要 roles:write 权限',
        },
      },
    )
    .patch(
      '/roles/:code',
      async ({ params, body, session, db, request, i18n }) => {
        if (!hasPermission(session, 'roles:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const result = await updateRoleWithAudit(
          params.code,
          body,
          session.userId,
          db,
          requestMeta(request, { trustProxy: plugins.trustProxy }),
        )
        if (result.isErr()) return mapError(result.error, i18n)
        return toRoleResponse(result.value)
      },
      {
        isAdmin: true,
        params: RoleCodeParams,
        body: UpdateRoleInputSchema,
        response: {
          200: RoleResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          409: ErrorResponse,
          429: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Admin/Roles'],
          summary: '更新角色',
          description: '更新名称/描述；系统角色只读。\n\n- 需要 roles:write 权限',
        },
      },
    )
    .put(
      '/roles/:code/permissions',
      async ({ params, body, session, db, request, sessionStore, i18n }) => {
        if (!hasPermission(session, 'roles:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const result = await setRolePermissionsWithAudit(
          params.code,
          body.permissions,
          session.userId,
          db,
          requestMeta(request, { trustProxy: plugins.trustProxy }),
        )
        if (result.isErr()) return mapError(result.error, i18n)

        // 权限变更立即生效: 撤销该角色下所有用户的会话
        for (const userId of result.value.affectedUserIds) {
          await sessionStore.destroyAllForUser(userId)
        }
        return toRoleResponse(result.value.role)
      },
      {
        isAdmin: true,
        params: RoleCodeParams,
        body: SetRolePermissionsInputSchema,
        response: {
          200: RoleResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          409: ErrorResponse,
          429: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Admin/Roles'],
          summary: '设置角色权限',
          description:
            '整体替换角色权限；系统角色只读。成功后撤销该角色用户的会话。\n\n- 需要 roles:write 权限',
        },
      },
    )
    .delete(
      '/roles/:code',
      async ({ params, session, db, request, sessionStore, i18n }) => {
        if (!hasPermission(session, 'roles:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const result = await deleteRoleWithAudit(
          params.code,
          session.userId,
          db,
          requestMeta(request, { trustProxy: plugins.trustProxy }),
        )
        if (result.isErr()) return mapError(result.error, i18n)
        for (const userId of result.value.affectedUserIds) {
          await sessionStore.destroyAllForUser(userId)
        }
        return status(204)
      },
      {
        isAdmin: true,
        params: RoleCodeParams,
        response: {
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          409: ErrorResponse,
          429: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Admin/Roles'],
          summary: '删除角色',
          description:
            '删除自定义角色；系统角色/仍有用户使用的角色不可删除。\n\n- 需要 roles:write 权限',
        },
      },
    )
}
