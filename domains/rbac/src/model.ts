import { Type } from '@sinclair/typebox'

export const RoleCodeSchema = Type.String({ pattern: '^[a-z][a-z0-9_-]{1,63}$' })

export const CreateRoleInputSchema = Type.Object({
  code: RoleCodeSchema,
  name: Type.String({ minLength: 1, maxLength: 100 }),
  description: Type.Optional(Type.String({ maxLength: 500 })),
  permissions: Type.Optional(Type.Array(Type.String({ maxLength: 100 }))),
})

export const UpdateRoleInputSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
})

export const SetRolePermissionsInputSchema = Type.Object({
  permissions: Type.Array(Type.String({ maxLength: 100 })),
})
