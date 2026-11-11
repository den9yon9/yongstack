import { Type } from '@sinclair/typebox'

export const PresignMediaUploadInputSchema = Type.Object({
  filename: Type.String({ minLength: 1, maxLength: 255 }),
  mime: Type.String({ minLength: 1, maxLength: 100 }),
  size: Type.Integer({ minimum: 1 }),
  purpose: Type.Optional(Type.String({ maxLength: 100 })),
})

export const ConfirmMediaUploadInputSchema = Type.Object({
  checksum: Type.Optional(Type.String({ maxLength: 64 })),
  width: Type.Optional(Type.Integer({ minimum: 1 })),
  height: Type.Optional(Type.Integer({ minimum: 1 })),
})
