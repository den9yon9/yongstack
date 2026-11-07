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

export const table = {
  select: {
    file: select(schema.files, {
      metadata: Type.Record(Type.String(), Type.Unknown()),
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
