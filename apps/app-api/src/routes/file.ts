import type { Db } from '@yongstack/database'
import { getFileForActor } from '@yongstack/file'
import * as FileModel from '@yongstack/file/model'
import {
  confirmMediaUpload,
  type MediaContext,
  type MediaError,
  presignMediaUpload,
  softDeleteMedia,
  uploadMedia,
} from '@yongstack/media'
import { hasPermission, type Session } from '@yongstack/session'
import { assertNever, ErrorResponse, requestMeta } from '@yongstack/shared'
import { Elysia, status, t } from 'elysia'

import { type AppPlugins } from '../plugins'

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
    case 'INTERNAL_ERROR':
      return status(503, { error, message: i18n('Internal server error') })
    default:
      return assertNever(error)
  }
}

export function createFileRoutes(plugins: AppPlugins) {
  const { dbPlugin, sessionPlugin, storage, logger } = plugins
  const { apiRateLimitPerMinute } = plugins

  function mediaContext(
    db: Db,
    session: Session,
    request: Request,
    canAccessAny: boolean,
  ): MediaContext {
    return {
      storage,
      db,
      logger,
      actor: { userId: session.userId, canAccessAny },
      meta: requestMeta(request, { trustProxy: plugins.trustProxy }),
      auditAction: {
        upload: 'app.file.upload',
        presign: 'app.file.presign',
        confirm: 'app.file.confirm',
        delete: 'app.file.delete',
      },
    }
  }

  return new Elysia({ name: 'file-app', prefix: '/files' })
    .use(plugins.localePlugin)
    .use(dbPlugin)
    .use(sessionPlugin)
    .use(plugins.apiRateLimit)
    .post(
      '/',
      async ({ body, session, db, request, i18n }) => {
        const result = await uploadMedia(
          {
            data: new Uint8Array(await body.file.arrayBuffer()),
            originalName: body.file.name,
            ...(body.purpose === undefined ? {} : { purpose: body.purpose }),
          },
          mediaContext(db, session, request, false),
        )
        if (result.isErr()) return mapMediaError(result.error, i18n)
        return status(201, result.value)
      },
      {
        isAuth: true,
        body: t.Object({
          file: t.File(),
          purpose: t.Optional(t.String({ maxLength: 100 })),
        }),
        response: {
          201: FileModel.FileResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          413: ErrorResponse,
          429: ErrorResponse,
          503: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Files'],
          summary: '上传文件',
          description:
            '上传图片等文件并写入元数据。\n\n- 需要登录\n- 类型/大小由运行时设置控制\n- 校验 magic bytes',
        },
      },
    )
    .post(
      '/presign',
      async ({ body, session, db, request, i18n }) => {
        const result = await presignMediaUpload(body, mediaContext(db, session, request, false))
        if (result.isErr()) return mapMediaError(result.error, i18n)
        return status(201, result.value)
      },
      {
        isAuth: true,
        body: FileModel.PresignFileInputSchema,
        response: {
          201: FileModel.PresignFileResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          413: ErrorResponse,
          429: ErrorResponse,
          503: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Files'],
          summary: '申请预签名上传地址',
          description:
            '校验类型/大小后签发直传 URL，并创建 pending 文件记录。\n\n- 需要登录\n- 客户端按返回 headers 上传后再调用 confirm\n- 未确认的上传由清理任务回收',
        },
      },
    )
    .post(
      '/:id/confirm',
      async ({ params, body, session, db, request, i18n }) => {
        const result = await confirmMediaUpload(
          params.id,
          body,
          mediaContext(db, session, request, hasPermission(session, 'files:write:any')),
        )
        if (result.isErr()) {
          if (result.error === 'FILE_NOT_FOUND') {
            return status(404, { error: result.error, message: i18n('Upload not found') })
          }
          return mapMediaError(result.error, i18n)
        }
        return result.value
      },
      {
        isAuth: true,
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        body: FileModel.ConfirmFileInputSchema,
        response: {
          200: FileModel.FileResponseSchema,
          400: ErrorResponse,
          401: ErrorResponse,
          404: ErrorResponse,
          413: ErrorResponse,
          429: ErrorResponse,
          503: ErrorResponse,
        },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Files'],
          summary: '确认预签名上传',
          description:
            '校验对象存在、大小与类型后把 pending 记录置为 ready。\n\n- 需要登录且为上传发起人\n- 对象缺失/越权返回 404',
        },
      },
    )
    .get(
      '/:id',
      async ({ params, session, db, i18n }) => {
        const result = await getFileForActor(
          params.id,
          {
            userId: session.userId,
            canAccessAny: hasPermission(session, 'files:read:any'),
          },
          db,
        )
        if (result.isErr()) {
          return status(404, { error: result.error, message: i18n('File not found') })
        }
        return result.value
      },
      {
        isAuth: true,
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        response: {
          200: FileModel.FileResponseSchema,
          401: ErrorResponse,
          404: ErrorResponse,
        },
        detail: {
          tags: ['Files'],
          summary: '文件元数据',
          description: '按 ID 获取文件元数据，仅 owner 或拥有 files:read:any 权限者可见。',
        },
      },
    )
    .delete(
      '/:id',
      async ({ params, session, db, request, i18n }) => {
        const result = await softDeleteMedia(
          params.id,
          mediaContext(db, session, request, hasPermission(session, 'files:delete:any')),
        )
        if (result.isErr()) return mapMediaError(result.error, i18n)
        return status(204)
      },
      {
        isAuth: true,
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        response: { 404: ErrorResponse, 429: ErrorResponse },
        rateLimit: { limit: apiRateLimitPerMinute, window: '60s' },
        detail: {
          tags: ['Files'],
          summary: '删除文件',
          description:
            '软删除文件元数据并尝试删除对象存储。仅 owner 或拥有 files:delete:any 权限者可操作。',
        },
      },
    )
}
