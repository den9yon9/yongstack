import type { Static } from '@sinclair/typebox'
import { type DbClient, schema } from '@yongstack/database'
import { err, ok, type Result } from '@yongstack/shared'
import { and, count, desc, eq, ilike, isNull, or } from 'drizzle-orm'

import type { AttachFileInputSchema, CreateFileInputSchema, FileListQuerySchema } from './model'

export type FileError = 'FILE_NOT_FOUND'

type File = typeof schema.files.$inferSelect

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
    })
    .returning()
  return file
}

export async function getFileById(id: string, client: DbClient): Promise<Result<File, FileError>> {
  const [file] = await client
    .select()
    .from(schema.files)
    .where(and(eq(schema.files.id, id), isNull(schema.files.deletedAt)))
  if (!file) return err('FILE_NOT_FOUND')
  return ok(file)
}

export async function listFiles(query: Static<typeof FileListQuerySchema>, client: DbClient) {
  const { page, pageSize, q, ownerId, purpose } = query
  const conditions = [isNull(schema.files.deletedAt)]
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
    .where(and(eq(schema.files.id, id), isNull(schema.files.deletedAt)))
  if (!file) return err('FILE_NOT_FOUND')

  await client.update(schema.files).set({ deletedAt: new Date() }).where(eq(schema.files.id, id))
  return ok({ key: file.key })
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
      ),
    )
    .orderBy(schema.fileAttachments.sortOrder, schema.fileAttachments.createdAt)
}
