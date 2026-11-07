import { listFiles, softDeleteFile } from '@yongstack/file'
import * as FileModel from '@yongstack/file/model'
import { hasPermission } from '@yongstack/session'
import { ErrorResponse } from '@yongstack/shared'
import { Elysia, status, t } from 'elysia'

import { type AdminPlugins } from '../plugins'

export function createFileRoutes(plugins: AdminPlugins) {
  const { storage } = plugins

  return new Elysia({ name: 'file-admin', prefix: '/admin' })
    .use(plugins.localePlugin)
    .use(plugins.dbPlugin)
    .use(plugins.sessionPlugin)
    .get(
      '/files',
      async ({ query, session, db, i18n }) => {
        if (!hasPermission(session, 'files:read')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        return listFiles(query, db)
      },
      {
        isAdmin: true,
        query: FileModel.FileListQuerySchema,
        response: {
          200: FileModel.FileListResponseSchema,
          401: ErrorResponse,
          403: ErrorResponse,
        },
        detail: {
          tags: ['Admin/Files'],
          summary: '文件列表',
          description: '分页文件列表，支持关键词/owner/purpose 筛选。\n\n- 需要 files:read 权限',
        },
      },
    )
    .delete(
      '/files/:id',
      async ({ params, session, db, i18n }) => {
        if (!hasPermission(session, 'files:delete')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const deleted = await softDeleteFile(params.id, db)
        if (deleted.isErr()) {
          return status(404, { error: deleted.error, message: i18n('File not found') })
        }
        await storage.delete(deleted.value.key)
        return status(204)
      },
      {
        isAdmin: true,
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        response: { 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse },
        detail: {
          tags: ['Admin/Files'],
          summary: '删除文件',
          description: '软删除文件并尝试删除对象存储。\n\n- 需要 files:delete 权限',
        },
      },
    )
}
