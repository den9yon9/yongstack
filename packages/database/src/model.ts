import { Type } from '@sinclair/typebox'
import {
  createInsertSchema as insert,
  createSelectSchema as select,
  createUpdateSchema as update,
} from 'drizzle-typebox'

import * as schema from './schema'

const userSelect = select(schema.users)

export const emailSchema = Type.Transform(Type.String({ format: 'email', maxLength: 255 }))
  .Decode((v) => v.toLowerCase().trim())
  .Encode((v) => v)

// E.164: + 国家码 + 8-15 位号码, 例如 +8613800000000
export const phoneSchema = Type.Transform(
  Type.String({ pattern: '^\\+[1-9]\\d{7,14}$', maxLength: 16 }),
)
  .Decode((v) => v.trim())
  .Encode((v) => v)

export const table = {
  select: {
    auditLog: select(schema.auditLogs, {
      diff: Type.Record(Type.String(), Type.Unknown()),
    }),
    file: select(schema.files, {
      metadata: Type.Record(Type.String(), Type.Unknown()),
    }),
    outboxEvent: select(schema.outboxEvents, {
      payload: Type.Record(Type.String(), Type.Unknown()),
    }),
    user: Type.Omit(userSelect, ['passwordHash']),
  },
  insert: {
    user: insert(schema.users, {
      email: emailSchema,
      name: Type.String({ minLength: 1, maxLength: 255 }),
      phone: Type.Optional(Type.String({ maxLength: 50 })),
    }),
  },
  update: {
    user: update(schema.users, {
      email: Type.Optional(emailSchema),
    }),
  },
}
