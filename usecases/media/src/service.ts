import { recordAudit, type RecordAuditInput } from '@yongstack/audit'
import type { DbClient } from '@yongstack/database'
import { createFile, type File, getPendingFileForActor, markFileReady } from '@yongstack/file'
import { getSetting } from '@yongstack/settings'
import { err, ok, type Result } from '@yongstack/shared'

export type MediaError =
  'STORAGE_UNAVAILABLE' | 'FILE_NOT_FOUND' | 'FILE_TOO_LARGE' | 'FILE_TYPE_NOT_ALLOWED'

export interface MediaStorage {
  createKey(extension: string): string
  publicUrl(key: string): string
  presignPut(
    key: string,
    contentType: string,
    expiresInSeconds?: number,
  ): Promise<Result<string, 'STORAGE_UNAVAILABLE'>>
  head(
    key: string,
  ): Promise<Result<{ size: number; contentType: string | null }, 'STORAGE_UNAVAILABLE'>>
  delete(key: string): Promise<Result<void, 'STORAGE_UNAVAILABLE'>>
}

type AuditMeta = Pick<RecordAuditInput, 'ip' | 'userAgent' | 'requestId'>

export interface MediaContext {
  storage: MediaStorage
  db: DbClient
  actor: { userId: string; isAdmin: boolean }
  meta: AuditMeta
  auditAction: { presign: string; confirm: string }
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
}

function extensionFor(filename: string, mime: string): string {
  const known = MIME_EXTENSIONS[mime]
  if (known) return known
  const fromName = filename.split('.').pop()?.toLowerCase() ?? ''
  return /^[a-z0-9]{1,10}$/.test(fromName) ? fromName : 'bin'
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
  const [maxBytes, allowedTypes] = await Promise.all([
    getSetting('upload.maxBytes', ctx.db),
    getSetting('upload.allowedTypes', ctx.db),
  ])
  if (input.size > maxBytes) return err('FILE_TOO_LARGE')
  if (!allowedTypes.includes(input.mime)) return err('FILE_TYPE_NOT_ALLOWED')

  const key = ctx.storage.createKey(extensionFor(input.filename, input.mime))
  const expiresInSeconds = 600
  const uploadUrl = await ctx.storage.presignPut(key, input.mime, expiresInSeconds)
  if (uploadUrl.isErr()) return err(uploadUrl.error)

  const file = await createFile(
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
    ctx.db,
  )

  await recordAudit(
    {
      actorId: ctx.actor.userId,
      action: ctx.auditAction.presign,
      targetType: 'file',
      targetId: file.id,
      diff: { key, mime: input.mime, size: input.size, purpose: file.purpose },
      ...ctx.meta,
    },
    ctx.db,
  )

  return ok({
    fileId: file.id,
    key,
    publicUrl: file.url,
    uploadUrl: uploadUrl.value,
    headers: {
      'Content-Type': input.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    expiresInSeconds,
  })
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
  if (head.isErr()) return err(head.error)

  const [maxBytes, allowedTypes] = await Promise.all([
    getSetting('upload.maxBytes', ctx.db),
    getSetting('upload.allowedTypes', ctx.db),
  ])
  if (head.value.size > maxBytes) {
    await ctx.storage.delete(pending.value.key)
    return err('FILE_TOO_LARGE')
  }
  const mime = head.value.contentType ?? pending.value.mime
  if (!allowedTypes.includes(mime)) {
    await ctx.storage.delete(pending.value.key)
    return err('FILE_TYPE_NOT_ALLOWED')
  }

  const result = await markFileReady(
    fileId,
    {
      size: head.value.size,
      mime,
      ...(input.checksum === undefined ? {} : { checksum: input.checksum }),
      ...(input.width === undefined ? {} : { width: input.width }),
      ...(input.height === undefined ? {} : { height: input.height }),
    },
    ctx.db,
  )
  if (result.isErr()) return err('FILE_NOT_FOUND')

  await recordAudit(
    {
      actorId: ctx.actor.userId,
      action: ctx.auditAction.confirm,
      targetType: 'file',
      targetId: result.value.id,
      diff: { key: result.value.key, size: result.value.size, mime: result.value.mime },
      ...ctx.meta,
    },
    ctx.db,
  )
  return ok(result.value)
}
