import { Type } from '@sinclair/typebox'
import { emailSchema, table } from '@yongstack/database'
import { PaginatedResponse, PaginationQuery } from '@yongstack/shared'

export const UserResponseSchema = table.select.user

export const AuthUserResponseSchema = Type.Intersect([
  UserResponseSchema,
  Type.Object({
    roles: Type.Array(Type.String()),
    permissions: Type.Array(Type.String()),
  }),
])

export const UserWithRolesResponseSchema = Type.Intersect([
  UserResponseSchema,
  Type.Object({ roles: Type.Array(Type.String()) }),
])

export const RegisterInputSchema = Type.Intersect([
  Type.Omit(table.insert.user, [
    'id',
    'passwordHash',
    'isActive',
    'avatar',
    'locale',
    'emailVerifiedAt',
    'lastLoginAt',
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

export const UpdateUserInputSchema = Type.Object({
  isActive: Type.Optional(Type.Boolean()),
})

export const UpdateUserAccessInputSchema = Type.Object({
  roles: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { minItems: 1 })),
  isActive: Type.Optional(Type.Boolean()),
})

export const UserListQuerySchema = Type.Composite([
  PaginationQuery,
  Type.Object({
    q: Type.Optional(Type.String({ maxLength: 100 })),
    isActive: Type.Optional(Type.Boolean()),
  }),
])

export const UserListResponseSchema = PaginatedResponse(UserWithRolesResponseSchema)

export const VerifyEmailInputSchema = Type.Object({
  token: Type.String({ minLength: 32, maxLength: 128 }),
})

export const ForgotPasswordInputSchema = Type.Object({
  email: emailSchema,
})

export const ResetPasswordInputSchema = Type.Object({
  token: Type.String({ minLength: 32, maxLength: 128 }),
  password: Type.String({ minLength: 8, maxLength: 128 }),
})

export const ChangePasswordInputSchema = Type.Object({
  currentPassword: Type.String({ minLength: 1, maxLength: 128 }),
  newPassword: Type.String({ minLength: 8, maxLength: 128 }),
})
