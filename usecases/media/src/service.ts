import { createHash } from 'node:crypto'

import { withAudit } from '@yongstack/audit'
import type { DbClient } from '@yongstack/database'
import {
  createFile,
  type File,
  getPendingFileForActor,
  markFileReady,
  softDeleteFileForActor,
} from '@yongstack/file'
import { getSetting } from '@yongstack/settings'
import { err, InvariantViolation, type Logger, ok, type Result } from '@yongstack/shared'
import { fileTypeFromBuffer } from 'file-type'
import { imageSize } from 'image-size'
import mime from 'mime'

export type MediaError =
  | 'STORAGE_UNAVAILABLE'
  | 'FILE_NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'FILE_TYPE_NOT_ALLOWED'
  // 对象已写入但元数据/审计失败(调用方负责清理对象, 对外映射为 5xx)
  | 'INTERNAL_ERROR'

// 与 StorageError 保持结构兼容(usecase 不能 import infrastructure 的 storage 包)
type StorageFailure = 'STORAGE_UNAVAILABLE' | 'STORAGE_NOT_FOUND'

export interface MediaStorage {
  createKey(extension: string): string
  publicUrl(key: string): string
  put(key: string, body: Uint8Array, contentType: string): Promise<Result<void, StorageFailure>>
  presignPut(
    key: string,
    contentType: string,
    expiresInSeconds?: number,
  ): Promise<Result<string, StorageFailure>>
  head(key: string): Promise<Result<{ size: number; contentType: string | null }, StorageFailure>>
  delete(key: string): Promise<Result<void, StorageFailure>>
}

type AuditMeta = {
  ip?: string | null
  userAgent?: string | null
  requestId?: string | null
}

export interface MediaContext {
  storage: MediaStorage
  db: DbClient
  actor: { userId: string; canAccessAny: boolean }
  meta: AuditMeta
  logger: Logger
  // 审计 action 名由调用方给, 保持 app.file.* / admin.file.* 的区分
  auditAction: { upload: string; presign: string; confirm: string; delete: string }
}

const PRESIGN_EXPIRES_IN_SECONDS = 600
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

// 扩展名只用于对象 key 的可读性; 内容类型以存储元数据为准。
// 不信任用户文件名(可能是 .html/.svg); 未知类型回退 bin。
function extensionFor(contentType: string): string {
  return mime.getExtension(contentType) ?? 'bin'
}

// head() 可能返回 "image/png; charset=..." 之类; 与 allowedTypes 比较前归一化
function normalizeContentType(value: string): string {
  return value.split(';')[0]?.trim().toLowerCase() ?? value
}

async function resolveUploadSettings(db: DbClient) {
  const [maxBytes, allowedTypes] = await Promise.all([
    getSetting('upload.maxBytes', db),
    getSetting('upload.allowedTypes', db),
  ])
  return { maxBytes, allowedTypes }
}

export interface PresignMediaUploadInput {
  filename: string
  mime: string
  size: number
  purpose?: string
}

export interface PresignMediaUploadResult {
  fileId: string
  key: string
  publicUrl: string
  uploadUrl: string
  headers: Record<string, string>
  expiresInSeconds: number
}

export async function presignMediaUpload(
  input: PresignMediaUploadInput,
  ctx: MediaContext,
): Promise<Result<PresignMediaUploadResult, MediaError>> {
  const { maxBytes, allowedTypes } = await resolveUploadSettings(ctx.db)
  if (input.size > maxBytes) return err('FILE_TOO_LARGE')
  if (!allowedTypes.includes(input.mime)) return err('FILE_TYPE_NOT_ALLOWED')

  const key = ctx.storage.createKey(extensionFor(input.mime))
  const uploadUrl = await ctx.storage.presignPut(key, input.mime, PRESIGN_EXPIRES_IN_SECONDS)
  if (uploadUrl.isErr()) return err('STORAGE_UNAVAILABLE')

  try {
    const created = await withAudit(
      ctx.db,
      (file: File) => ({
        actorId: ctx.actor.userId,
        action: ctx.auditAction.presign,
        targetType: 'file',
        targetId: file.id,
        diff: { key, mime: input.mime, size: input.size, purpose: file.purpose },
        ...ctx.meta,
      }),
      (tx) =>
        createFile(
          {
            ownerId: ctx.actor.userId,
            key,
            url: ctx.storage.publicUrl(key),
            mime: input.mime,
            size: input.size,
            purpose: input.purpose ?? 'general',
            status: 'pending',
            metadata: { originalName: input.filename },
          },
          tx,
        ).then((file) => ok(file)),
    )
    if (created.isErr()) return err('INTERNAL_ERROR')

    return ok({
      fileId: created.value.id,
      key,
      publicUrl: created.value.url,
      uploadUrl: uploadUrl.value,
      headers: {
        'Content-Type': input.mime,
        'Cache-Control': CACHE_CONTROL,
      },
      expiresInSeconds: PRESIGN_EXPIRES_IN_SECONDS,
    })
  } catch (error) {
    ctx.logger.error({ err: error, key }, 'presign metadata write failed')
    return err('INTERNAL_ERROR')
  }
}

export interface ConfirmMediaUploadInput {
  checksum?: string
  width?: number
  height?: number
}

export async function confirmMediaUpload(
  fileId: string,
  input: ConfirmMediaUploadInput,
  ctx: MediaContext,
): Promise<Result<File, MediaError>> {
  const pending = await getPendingFileForActor(fileId, ctx.actor, ctx.db)
  if (pending.isErr()) return err('FILE_NOT_FOUND')

  const head = await ctx.storage.head(pending.value.key)
  if (head.isErr()) {
    return err(head.error === 'STORAGE_NOT_FOUND' ? 'FILE_NOT_FOUND' : head.error)
  }

  const { maxBytes, allowedTypes } = await resolveUploadSettings(ctx.db)
  if (head.value.size > maxBytes) {
    await ctx.storage.delete(pending.value.key)
    return err('FILE_TOO_LARGE')
  }
  const contentType = normalizeContentType(head.value.contentType ?? pending.value.mime)
  if (!allowedTypes.includes(contentType)) {
    await ctx.storage.delete(pending.value.key)
    return err('FILE_TYPE_NOT_ALLOWED')
  }

  const result = await withAudit(
    ctx.db,
    {
      actorId: ctx.actor.userId,
      action: ctx.auditAction.confirm,
      targetType: 'file',
      targetId: fileId,
      diff: { key: pending.value.key, size: head.value.size, mime: contentType },
      ...ctx.meta,
    },
    (tx) =>
      markFileReady(
        fileId,
        {
          size: head.value.size,
          mime: contentType,
          ...(input.checksum === undefined ? {} : { checksum: input.checksum }),
          ...(input.width === undefined ? {} : { width: input.width }),
          ...(input.height === undefined ? {} : { height: input.height }),
        },
        tx,
      ),
  )
  if (result.isErr()) return err(result.error)
  return ok(result.value)
}

export interface UploadMediaInput {
  data: Uint8Array
  originalName: string
  purpose?: string
}

// 服务端上传: 校验真实内容(magic bytes) + 尺寸, 写对象, 元数据与审计同事务。
// DB/审计失败时删除已写入对象, 避免孤儿文件。
export async function uploadMedia(
  input: UploadMediaInput,
  ctx: MediaContext,
): Promise<Result<File, MediaError>> {
  const { maxBytes, allowedTypes } = await resolveUploadSettings(ctx.db)
  if (input.data.byteLength > maxBytes) return err('FILE_TOO_LARGE')

  const detected = await fileTypeFromBuffer(input.data)
  if (detected === undefined) return err('FILE_TYPE_NOT_ALLOWED')
  if (!allowedTypes.includes(detected.mime)) return err('FILE_TYPE_NOT_ALLOWED')

  let width: number | null = null
  let height: number | null = null
  if (detected.mime.startsWith('image/')) {
    try {
      const dimensions = imageSize(input.data)
      width = dimensions.width ?? null
      height = dimensions.height ?? null
    } catch {
      // 无法解析尺寸时仍保存原图, 尺寸留空
    }
  }

  const purpose = input.purpose ?? 'general'
  const key = ctx.storage.createKey(detected.ext)
  const uploaded = await ctx.storage.put(key, input.data, detected.mime)
  if (uploaded.isErr()) return err('STORAGE_UNAVAILABLE')

  try {
    const created = await withAudit(
      ctx.db,
      {
        actorId: ctx.actor.userId,
        action: ctx.auditAction.upload,
        targetType: 'file',
        diff: { key, mime: detected.mime, size: input.data.byteLength, purpose },
        ...ctx.meta,
      },
      (tx) =>
        createFile(
          {
            ownerId: ctx.actor.userId,
            key,
            url: ctx.storage.publicUrl(key),
            mime: detected.mime,
            size: input.data.byteLength,
            ...(width === null ? {} : { width }),
            ...(height === null ? {} : { height }),
            purpose,
            checksum: createHash('sha256').update(input.data).digest('hex'),
            metadata: { originalName: input.originalName },
          },
          tx,
        ).then((file) => ok(file)),
    )
    if (created.isErr()) throw new InvariantViolation('file metadata write failed')
    return ok(created.value)
  } catch (error) {
    // 元数据写入失败, 清理已上传对象避免孤儿文件(尽力而为)
    const cleaned = await ctx.storage.delete(key)
    if (cleaned.isErr()) {
      ctx.logger.error({ err: cleaned.error, key }, 'orphan file cleanup failed')
    }
    ctx.logger.error({ err: error, key }, 'file metadata insert failed')
    return err('INTERNAL_ERROR')
  }
}

// 软删元数据 + 尽力删除对象; 对象删除失败由清理任务兜底, 不影响请求结果。
export async function softDeleteMedia(
  fileId: string,
  ctx: MediaContext,
): Promise<Result<void, 'FILE_NOT_FOUND'>> {
  const deleted = await withAudit(
    ctx.db,
    (result: { key: string }) => ({
      actorId: ctx.actor.userId,
      action: ctx.auditAction.delete,
      targetType: 'file',
      targetId: fileId,
      diff: { key: result.key },
      ...ctx.meta,
    }),
    (tx) => softDeleteFileForActor(fileId, ctx.actor, tx),
  )
  if (deleted.isErr()) return err(deleted.error)

  const removed = await ctx.storage.delete(deleted.value.key)
  if (removed.isErr()) {
    ctx.logger.error(
      { err: removed.error, key: deleted.value.key },
      'storage delete failed after soft delete',
    )
  }
  return ok(undefined)
}
