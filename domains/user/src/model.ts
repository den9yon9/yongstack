import { Type } from '@sinclair/typebox'
import { emailSchema, phoneSchema, table } from '@yongstack/database'
import { PaginatedResponse, PaginationQuery } from '@yongstack/shared'

// 响应契约按"信任边界 + 消费场景"拆开, 一律白名单:
// - 自助视角(app-api): 只暴露"我自己的资料"需要的字段
// - 管理视角(admin-api): 额外需要账号状态与安全字段
// 新增表字段默认不会出现在任何响应里, 需要暴露必须在这里显式添加。
const SelfUserBase = Type.Pick(table.select.user, [
  'id',
  'name',
  'email',
  'phone',
  'avatar',
  'locale',
  'emailVerifiedAt',
  'phoneVerifiedAt',
  'createdAt',
])

export const UserResponseSchema = SelfUserBase

export const AuthUserResponseSchema = Type.Intersect([
  SelfUserBase,
  Type.Object({
    roles: Type.Array(Type.String()),
    permissions: Type.Array(Type.String()),
  }),
])

export const AdminUserResponseSchema = Type.Pick(table.select.user, [
  'id',
  'name',
  'email',
  'phone',
  'avatar',
  'locale',
  'emailVerifiedAt',
  'phoneVerifiedAt',
  'lastLoginAt',
  'isActive',
  'createdAt',
])

export const AdminAuthUserResponseSchema = Type.Intersect([
  AdminUserResponseSchema,
  Type.Object({
    roles: Type.Array(Type.String()),
    permissions: Type.Array(Type.String()),
  }),
])

export const AdminUserWithRolesResponseSchema = Type.Intersect([
  AdminUserResponseSchema,
  Type.Object({ roles: Type.Array(Type.String()) }),
])

export const RegisterInputSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  // 必须复用 emailSchema, 否则会丢掉 toLowerCase/trim 的 Decode 变换
  email: emailSchema,
  password: Type.String({ minLength: 8, maxLength: 128 }),
})

export const LoginInputSchema = Type.Object({
  email: emailSchema,
  password: Type.String({ minLength: 1, maxLength: 128 }),
})

// 手机号只能通过验证码绑定流程修改, 不在普通资料更新中开放
export const UpdateProfileInputSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
  avatar: Type.Optional(Type.String({ maxLength: 5000 })),
})

const PhoneCodeSchema = Type.String({ pattern: '^\\d{6}$', maxLength: 6 })

export const PhoneLoginRequestSchema = Type.Object({
  phone: phoneSchema,
})

export const PhoneLoginVerifySchema = Type.Object({
  phone: phoneSchema,
  code: PhoneCodeSchema,
})

export const PhoneBindRequestSchema = Type.Object({
  phone: phoneSchema,
})

export const PhoneBindVerifySchema = Type.Object({
  phone: phoneSchema,
  code: PhoneCodeSchema,
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

export const UserListResponseSchema = PaginatedResponse(AdminUserWithRolesResponseSchema)

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
