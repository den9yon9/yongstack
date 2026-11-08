import { createHash } from 'node:crypto'

import { withAudit } from '@yongstack/audit'
import { createFile, getFileForActor, softDeleteFileForActor } from '@yongstack/file'
import * as FileModel from '@yongstack/file/model'
import { ADMIN_ROLE_CODE } from '@yongstack/rbac'
import { isAdminSession } from '@yongstack/session'
import { getSetting } from '@yongstack/settings'
import { ErrorResponse, ok, requestMeta } from '@yongstack/shared'
import { Elysia, status, t } from 'elysia'
import { fileTypeFromBuffer } from 'file-type'
import { imageSize } from 'image-size'

import { type AppPlugins } from '../plugins'

export function createFileRoutes(plugins: AppPlugins) {
  const { dbPlugin, sessionPlugin, storage, logger } = plugins

  return new Elysia({ name: 'file-app', prefix: '/files' })
    .use(plugins.localePlugin)
    .use(dbPlugin)
    .use(sessionPlugin)
    .post(
      '/',
      async ({ body, session, db, request, i18n }) => {
        const maxBytes = await getSetting('upload.maxBytes', db)
        if (body.file.size > maxBytes) {
          return status(413, { error: 'FILE_TOO_LARGE', message: i18n('File too large') })
        }

        const buffer = Buffer.from(await body.file.arrayBuffer())
        const detected = await fileTypeFromBuffer(buffer)
        if (!detected) {
          return status(400, {
            error: 'FILE_TYPE_NOT_ALLOWED',
            message: i18n('Unsupported file type'),
          })
        }
        const mime = detected.mime
        const allowedTypes = await getSetting('upload.allowedTypes', db)
        if (!allowedTypes.includes(mime)) {
          return status(400, {
            error: 'FILE_TYPE_NOT_ALLOWED',
            message: i18n('Unsupported file type'),
          })
        }

        let width: number | null = null
        let height: number | null = null
        if (mime.startsWith('image/')) {
          try {
            const dimensions = imageSize(buffer)
            width = dimensions.width ?? null
            height = dimensions.height ?? null
          } catch {
            // 无法解析尺寸时仍保存原图, 尺寸留空
          }
        }

        const key = storage.createKey(detected.ext)
        const uploaded = await storage.put(key, buffer, mime)
        if (uploaded.isErr()) {
          return status(503, {
            error: 'STORAGE_UNAVAILABLE',
            message: i18n('Storage unavailable'),
          })
        }

        // 元数据写入(含审计)失败时清理已上传对象, 避免孤儿文件
        try {
          const file = await withAudit(
            db,
            {
              actorId: session.userId,
              action: 'app.file.upload',
              targetType: 'file',
              diff: { key, mime, size: buffer.length, purpose: body.purpose ?? 'general' },
              ...requestMeta(request, { trustProxy: plugins.trustProxy }),
            },
            (tx) =>
              createFile(
                {
                  ownerId: session.userId,
                  key,
                  url: storage.publicUrl(key),
                  mime,
                  size: buffer.length,
                  ...(width === null ? {} : { width }),
                  ...(height === null ? {} : { height }),
                  purpose: body.purpose ?? 'general',
                  checksum: createHash('sha256').update(buffer).digest('hex'),
                  metadata: { originalName: body.file.name },
                },
                tx,
              ).then((file) => ok(file)),
          )
          if (file.isErr()) throw file.error
          return status(201, file.value)
        } catch (error) {
          // 元数据写入失败, 清理已上传对象避免孤儿文件(尽力而为)
          const cleaned = await storage.delete(key)
          if (cleaned.isErr()) {
            logger.error({ err: cleaned.error, key }, 'orphan file cleanup failed')
          }
          logger.error({ err: error, key }, 'file metadata insert failed')
          return status(503, {
            error: 'INTERNAL_ERROR',
            message: i18n('Internal server error'),
          })
        }
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
          503: ErrorResponse,
        },
        detail: {
          tags: ['Files'],
          summary: '上传文件',
          description:
            '上传图片等文件并写入元数据。\n\n- 需要登录\n- 类型/大小由运行时设置控制\n- 校验 magic bytes',
        },
      },
    )
    .get(
      '/:id',
      async ({ params, session, db, i18n }) => {
        const result = await getFileForActor(
          params.id,
          { userId: session.userId, isAdmin: isAdminSession(session, ADMIN_ROLE_CODE) },
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
          description: '按 ID 获取文件元数据，仅 owner 或 admin 可见。',
        },
      },
    )
    .delete(
      '/:id',
      async ({ params, session, db, request, i18n }) => {
        const deleted = await withAudit(
          db,
          (softDeleted: { key: string }) => ({
            actorId: session.userId,
            action: 'app.file.delete',
            targetType: 'file',
            targetId: params.id,
            diff: { key: softDeleted.key },
            ...requestMeta(request, { trustProxy: plugins.trustProxy }),
          }),
          (tx) =>
            softDeleteFileForActor(
              params.id,
              { userId: session.userId, isAdmin: isAdminSession(session, ADMIN_ROLE_CODE) },
              tx,
            ),
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
        isAuth: true,
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        response: { 404: ErrorResponse },
        detail: {
          tags: ['Files'],
          summary: '删除文件',
          description: '软删除文件元数据并尝试删除对象存储。仅 owner 或 admin 可操作。',
        },
      },
    )
}
