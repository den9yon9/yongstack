import { Type } from '@sinclair/typebox'
import { table } from '@yongstack/database'
import { PaginatedResponse, PaginationQuery } from '@yongstack/shared'

export const FileResponseSchema = Type.Omit(table.select.file, ['deletedAt'])

export const CreateFileInputSchema = Type.Object({
  ownerId: Type.Optional(Type.String({ format: 'uuid' })),
  key: Type.String({ minLength: 1, maxLength: 500 }),
  url: Type.String({ minLength: 1 }),
  mime: Type.String({ minLength: 1, maxLength: 100 }),
  size: Type.Integer({ minimum: 0 }),
  width: Type.Optional(Type.Integer({ minimum: 1 })),
  height: Type.Optional(Type.Integer({ minimum: 1 })),
  purpose: Type.Optional(Type.String({ maxLength: 100 })),
  checksum: Type.Optional(Type.String({ maxLength: 64 })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
})

export const FileListQuerySchema = Type.Composite([
  PaginationQuery,
  Type.Object({
    q: Type.Optional(Type.String({ maxLength: 100 })),
    ownerId: Type.Optional(Type.String({ format: 'uuid' })),
    purpose: Type.Optional(Type.String({ maxLength: 100 })),
  }),
])

export const FileListResponseSchema = PaginatedResponse(FileResponseSchema)

export const AttachFileInputSchema = Type.Object({
  fileId: Type.String({ format: 'uuid' }),
  ownerType: Type.String({ minLength: 1, maxLength: 100 }),
  ownerId: Type.String({ format: 'uuid' }),
  sortOrder: Type.Optional(Type.Integer()),
})
