import { withAudit } from '@yongstack/audit'
import { listFiles, softDeleteFileForActor } from '@yongstack/file'
import * as FileModel from '@yongstack/file/model'
import {
  confirmMediaUpload,
  type MediaContext,
  type MediaError,
  presignMediaUpload,
} from '@yongstack/media'
import {
  ConfirmMediaUploadInputSchema,
  PresignMediaUploadInputSchema,
} from '@yongstack/media/model'
import { hasPermission } from '@yongstack/session'
import { assertNever, ErrorResponse, requestMeta } from '@yongstack/shared'
import { Elysia, status, t } from 'elysia'

import { type AdminPlugins } from '../plugins'

const PresignResponseSchema = t.Object({
  fileId: t.String({ format: 'uuid' }),
  key: t.String(),
  publicUrl: t.String(),
  uploadUrl: t.String(),
  headers: t.Record(t.String(), t.String()),
  expiresInSeconds: t.Number(),
})

function mapMediaError(error: MediaError, i18n: (text: string) => string) {
  switch (error) {
    case 'FILE_TOO_LARGE':
      return status(413, { error, message: i18n('File too large') })
    case 'FILE_TYPE_NOT_ALLOWED':
      return status(400, { error, message: i18n('Unsupported file type') })
    case 'FILE_NOT_FOUND':
      return status(404, { error, message: i18n('File not found') })
    case 'STORAGE_UNAVAILABLE':
      return status(503, { error, message: i18n('Storage unavailable') })
    default:
      return assertNever(error)
  }
}

export function createFileRoutes(plugins: AdminPlugins) {
  const { storage, logger, apiRateLimitPerMinute } = plugins

  function mediaContext(
    db: MediaContext['db'],
    session: { userId: string },
    request: Request,
  ): MediaContext {
    return {
      storage,
      db,
      actor: { userId: session.userId, isAdmin: true },
      meta: requestMeta(request, { trustProxy: plugins.trustProxy }),
      auditAction: { presign: 'admin.file.presign', confirm: 'admin.file.confirm' },
    }
  }

  return new Elysia({ name: 'file-admin', prefix: '/admin' })
    .use(plugins.localePlugin)
    .use(plugins.dbPlugin)
    .use(plugins.sessionPlugin)
    .use(plugins.apiRateLimit)
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
    .post(
      '/files/presign',
      async ({ body, session, db, request, i18n }) => {
        if (!hasPermission(session, 'files:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const result = await presignMediaUpload(body, mediaContext(db, session, request))
        if (result.isErr()) return mapMediaError(result.error, i18n)
        return status(201, result.value)
      },
      {
        isAdmin: true,
        body: PresignMediaUploadInputSchema,
        response: {
          201: PresignResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          413: ErrorResponse,
          429: ErrorResponse,
          503: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Admin/Files'],
          summary: '申请文件上传地址',
          description:
            '校验类型/大小后签发直传 URL，并创建 pending 文件记录。\n\n- 需要 files:write 权限',
        },
      },
    )
    .post(
      '/files/:id/confirm',
      async ({ params, body, session, db, request, i18n }) => {
        if (!hasPermission(session, 'files:write')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const result = await confirmMediaUpload(params.id, body, mediaContext(db, session, request))
        if (result.isErr()) return mapMediaError(result.error, i18n)
        return result.value
      },
      {
        isAdmin: true,
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        body: ConfirmMediaUploadInputSchema,
        response: {
          200: FileModel.FileResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          413: ErrorResponse,
          429: ErrorResponse,
          503: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Admin/Files'],
          summary: '确认文件上传',
          description:
            '校验对象存在、大小与类型后把 pending 记录置为 ready。\n\n- 需要 files:write 权限',
        },
      },
    )
    .delete(
      '/files/:id',
      async ({ params, session, db, request, i18n }) => {
        if (!hasPermission(session, 'files:delete')) {
          return status(403, { error: 'FORBIDDEN', message: i18n('Forbidden') })
        }
        const deleted = await withAudit(
          db,
          (result: { key: string }) => ({
            actorId: session.userId,
            action: 'admin.file.delete',
            targetType: 'file',
            targetId: params.id,
            diff: { key: result.key },
            ...requestMeta(request, { trustProxy: plugins.trustProxy }),
          }),
          (tx) => softDeleteFileForActor(params.id, { userId: session.userId, isAdmin: true }, tx),
        )
        if (deleted.isErr()) {
          return status(404, { error: deleted.error, message: i18n('File not found') })
        }
        // 对象删除尽力而为; 失败时数据库记录已软删, 由清理任务兜底
        const removed = await storage.delete(deleted.value.key)
        if (removed.isErr()) {
          logger.error(
            { err: removed.error, key: deleted.value.key },
            'storage delete failed after soft delete',
          )
        }
        return status(204)
      },
      {
        isAdmin: true,
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        response: {
          401: ErrorResponse,
          403: ErrorResponse,
          404: ErrorResponse,
          429: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Admin/Files'],
          summary: '删除文件',
          description: '软删除文件并尝试删除对象存储。\n\n- 需要 files:delete 权限',
        },
      },
    )
}
