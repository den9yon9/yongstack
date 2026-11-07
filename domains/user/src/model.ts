import { Type } from '@sinclair/typebox'
import { emailSchema, table } from '@yongstack/database'

export const UserResponseSchema = table.select.user

export const RegisterInputSchema = Type.Intersect([
  Type.Omit(table.insert.user, [
    'id',
    'passwordHash',
    'role',
    'isActive',
    'avatar',
    'locale',
    'createdAt',
    'updatedAt',
  ]),
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 255 }),
    password: Type.String({ minLength: 8, maxLength: 128 }),
  }),
])

export const LoginInputSchema = Type.Object({
  email: emailSchema,
  password: Type.String({ minLength: 1, maxLength: 128 }),
})

export const UpdateProfileInputSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  phone: Type.Optional(Type.String({ maxLength: 50 })),
  avatar: Type.Optional(Type.String({ maxLength: 5000 })),
})
