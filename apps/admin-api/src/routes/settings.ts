import { Type } from '@sinclair/typebox'
import { hasPermission } from '@yongstack/session'
import { listSettings, updateSettings } from '@yongstack/settings'
import { assertNever, ErrorResponse } from '@yongstack/shared'
import { Elysia, status } from 'elysia'

import { type AdminPlugins } from '../plugins'

const SettingItemSchema = Type.Object({
  key: Type.String(),
  value: Type.Unknown(),
  description: Type.String(),
  updatedBy: Type.Union([Type.String(), Type.Null()]),
  version: Type.Number(),
  updatedAt: Type.Unknown(),
})

const SettingsResponseSchema = Type.Object({
  items: Type.Array(SettingItemSchema),
})

const UpdateSettingsInputSchema = Type.Object({
  values: Type.Record(Type.String(), Type.Unknown()),
})

export function createSettingsRoutes(plugins: AdminPlugins) {
  return new Elysia({ name: 'settings-admin', prefix: '/admin' })
    .use(plugins.localePlugin)
    .use(plugins.dbPlugin)
    .use(plugins.sessionPlugin)
    .get(
      '/settings',
      async ({ db, session, i18n }) => {
        if (!hasPermission(session, 'settings:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        return { items: await listSettings(db) }
      },
      {
        isAdmin: true,
        response: { 200: SettingsResponseSchema, 401: ErrorResponse, 403: ErrorResponse },
        detail: {
          tags: ['Admin/Settings'],
          summary: '运行时设置',
          description: '返回全部已定义设置与当前值；未写入的配置返回默认值。\n\n- 需要 admin 角色',
        },
      },
    )
    .put(
      '/settings',
      async ({ body, db, session, i18n }) => {
        if (!hasPermission(session, 'settings:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const result = await updateSettings(body.values, db, session.userId)
        if (result.isErr()) {
          switch (result.error.code) {
            case 'SETTING_UNKNOWN':
              return status(404, { error: result.error.code, message: i18n('Unknown setting') })
            case 'SETTING_INVALID':
              return status(400, {
                error: result.error.code,
                message: i18n('Invalid setting value'),
              })
            default:
              return assertNever(result.error.code)
          }
        }
        return { items: result.value }
      },
      {
        isAdmin: true,
        body: UpdateSettingsInputSchema,
        response: {
          200: SettingsResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Settings'],
          summary: '更新运行时设置',
          description:
            '批量写入设置值，未知 key 返回 404，类型不合法返回 400。\n\n- 需要 admin 角色\n- 每次更新 version + 1',
        },
      },
    )
}
