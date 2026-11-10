import type { Static } from '@sinclair/typebox'
import { type DbClient, schema } from '@yongstack/database'
import { err, ok, type Result } from '@yongstack/shared'
import { and, count, desc, eq, ilike, isNotNull, isNull, lt, or } from 'drizzle-orm'

import type { AttachFileInputSchema, CreateFileInputSchema, FileListQuerySchema } from './model'

export type FileError = 'FILE_NOT_FOUND'

type File = typeof schema.files.$inferSelect

// 授权下沉: 调用方(controller/usecase)只负责把 session 映射成 actor,
// 域函数查询条件即带 owner/admin 判定, 避免新调用方忘检越权。
export interface FileActor {
  userId: string
  isAdmin: boolean
}

// 只有 ready 且未软删的文件对调用方可见; pending 上传对普通读取不可见。
function activeWhere() {
  return and(isNull(schema.files.deletedAt), eq(schema.files.status, 'ready'))
}

// owner 一律可见; admin 视为超级读者/管理者。
function actorWhere(actor: FileActor) {
  if (actor.isAdmin) return activeWhere()
  return and(eq(schema.files.ownerId, actor.userId), activeWhere())
}

export async function createFile(
  input: Static<typeof CreateFileInputSchema>,
  client: DbClient,
): Promise<File> {
  const [file] = await client
    .insert(schema.files)
    .values({
      ownerId: input.ownerId ?? null,
      key: input.key,
      url: input.url,
      mime: input.mime,
      size: input.size,
      width: input.width ?? null,
      height: input.height ?? null,
      purpose: input.purpose ?? 'general',
      checksum: input.checksum ?? null,
      metadata: input.metadata ?? {},
      status: input.status ?? 'ready',
    })
    .returning()
  return file
}

export async function getFileById(id: string, client: DbClient): Promise<Result<File, FileError>> {
  const [file] = await client
    .select()
    .from(schema.files)
    .where(and(eq(schema.files.id, id), activeWhere()))
  if (!file) return err('FILE_NOT_FOUND')
  return ok(file)
}

// 预签名上传确认前读取: 仅 owner(或 admin) 可见，允许 pending 状态。
export async function getPendingFileForActor(
  id: string,
  actor: FileActor,
  client: DbClient,
): Promise<Result<File, FileError>> {
  const [file] = await client
    .select()
    .from(schema.files)
    .where(
      and(
        eq(schema.files.id, id),
        eq(schema.files.status, 'pending'),
        actor.isAdmin ? undefined : eq(schema.files.ownerId, actor.userId),
      ),
    )
  if (!file) return err('FILE_NOT_FOUND')
  return ok(file)
}

// 带 actor 授权的读取: 返回与 getFileById 相同的错误码, 不泄露他人文件存在性。
export async function getFileForActor(
  id: string,
  actor: FileActor,
  client: DbClient,
): Promise<Result<File, FileError>> {
  const [file] = await client
    .select()
    .from(schema.files)
    .where(and(eq(schema.files.id, id), actorWhere(actor)))
  if (!file) return err('FILE_NOT_FOUND')
  return ok(file)
}

export async function listFiles(query: Static<typeof FileListQuerySchema>, client: DbClient) {
  const { page, pageSize, q, ownerId, purpose } = query
  const conditions = [isNull(schema.files.deletedAt), eq(schema.files.status, 'ready')]
  if (ownerId !== undefined) conditions.push(eq(schema.files.ownerId, ownerId))
  if (purpose !== undefined) conditions.push(eq(schema.files.purpose, purpose))
  if (q !== undefined && q.trim().length > 0) {
    const pattern = `%${q.trim()}%`
    conditions.push(
      or(
        ilike(schema.files.key, pattern),
        ilike(schema.files.mime, pattern),
        ilike(schema.files.purpose, pattern),
      )!,
    )
  }
  const where = and(...conditions)

  const rows = await client
    .select()
    .from(schema.files)
    .where(where)
    .orderBy(desc(schema.files.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
  const [{ total }] = await client.select({ total: count() }).from(schema.files).where(where)
  return { items: rows, total: Number(total), page, pageSize }
}

export async function softDeleteFile(
  id: string,
  client: DbClient,
): Promise<Result<{ key: string }, FileError>> {
  const [file] = await client
    .select()
    .from(schema.files)
    .where(and(eq(schema.files.id, id), activeWhere()))
  if (!file) return err('FILE_NOT_FOUND')

  await client.update(schema.files).set({ deletedAt: new Date() }).where(eq(schema.files.id, id))
  return ok({ key: file.key })
}

// 带 actor 授权的软删: 校验通过后既软删 DB 记录。
export async function softDeleteFileForActor(
  id: string,
  actor: FileActor,
  client: DbClient,
): Promise<Result<{ key: string }, FileError>> {
  const [file] = await client
    .select()
    .from(schema.files)
    .where(and(eq(schema.files.id, id), actorWhere(actor)))
  if (!file) return err('FILE_NOT_FOUND')

  await client.update(schema.files).set({ deletedAt: new Date() }).where(eq(schema.files.id, id))
  return ok({ key: file.key })
}

// 预签名上传确认: 校验通过后把 pending 行补全为 ready。
export async function markFileReady(
  id: string,
  patch: { size: number; mime: string; checksum?: string; width?: number; height?: number },
  client: DbClient,
): Promise<Result<File, FileError>> {
  const [file] = await client
    .update(schema.files)
    .set({
      status: 'ready',
      size: patch.size,
      mime: patch.mime,
      checksum: patch.checksum ?? null,
      width: patch.width ?? null,
      height: patch.height ?? null,
    })
    .where(and(eq(schema.files.id, id), eq(schema.files.status, 'pending')))
    .returning()
  if (!file) return err('FILE_NOT_FOUND')
  return ok(file)
}

// 清理任务用: 列出已软删超过 cutoff 的文件(worker 负责删除对象并调用永久删除)。
export async function listStaleDeletedFiles(
  cutoff: Date,
  client: DbClient,
): Promise<{ id: string; key: string }[]> {
  return client
    .select({ id: schema.files.id, key: schema.files.key })
    .from(schema.files)
    .where(and(isNotNull(schema.files.deletedAt), lt(schema.files.deletedAt, cutoff)))
}

// 清理任务用: 预签名后长期未确认的上传(pending), 回收对象与行。
export async function listStalePendingFiles(
  cutoff: Date,
  client: DbClient,
): Promise<{ id: string; key: string }[]> {
  return client
    .select({ id: schema.files.id, key: schema.files.key })
    .from(schema.files)
    .where(
      and(
        eq(schema.files.status, 'pending'),
        isNull(schema.files.deletedAt),
        lt(schema.files.createdAt, cutoff),
      ),
    )
}

// 清理任务用: 对象已删除后硬删数据库行(attachments 级联)。
export async function permanentlyDeleteFile(id: string, client: DbClient): Promise<void> {
  await client.delete(schema.files).where(eq(schema.files.id, id))
}

export async function attachFile(
  input: Static<typeof AttachFileInputSchema>,
  client: DbClient,
): Promise<void> {
  await client
    .insert(schema.fileAttachments)
    .values({
      fileId: input.fileId,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      sortOrder: input.sortOrder ?? 0,
    })
    .onConflictDoNothing()
}

export async function detachFile(
  fileId: string,
  ownerType: string,
  ownerId: string,
  client: DbClient,
): Promise<void> {
  await client
    .delete(schema.fileAttachments)
    .where(
      and(
        eq(schema.fileAttachments.fileId, fileId),
        eq(schema.fileAttachments.ownerType, ownerType),
        eq(schema.fileAttachments.ownerId, ownerId),
      ),
    )
}

export async function listAttachments(ownerType: string, ownerId: string, client: DbClient) {
  return client
    .select({
      file: schema.files,
      sortOrder: schema.fileAttachments.sortOrder,
    })
    .from(schema.fileAttachments)
    .innerJoin(schema.files, eq(schema.files.id, schema.fileAttachments.fileId))
    .where(
      and(
        eq(schema.fileAttachments.ownerType, ownerType),
        eq(schema.fileAttachments.ownerId, ownerId),
        isNull(schema.files.deletedAt),
        eq(schema.files.status, 'ready'),
      ),
    )
    .orderBy(schema.fileAttachments.sortOrder, schema.fileAttachments.createdAt)
}
