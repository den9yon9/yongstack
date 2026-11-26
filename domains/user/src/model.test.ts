import { type TSchema } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { describe, expect, test } from 'bun:test'

import {
  AdminAuthUserResponseSchema,
  AdminUserResponseSchema,
  AdminUserWithRolesResponseSchema,
  AuthUserResponseSchema,
  RegisterInputSchema,
  UserResponseSchema,
} from './model'

type KeyedSchema = TSchema & {
  properties?: Record<string, TSchema>
  allOf?: TSchema[]
}

// Intersect 的字段分散在 allOf 里, 统一摊平成字段集合
function keysOf(schema: TSchema): string[] {
  const { properties, allOf } = schema as KeyedSchema
  if (properties !== undefined) return Object.keys(properties)
  if (allOf !== undefined) return [...new Set(allOf.flatMap(keysOf))]
  return []
}

const SELF_FIELDS = [
  'avatar',
  'createdAt',
  'email',
  'emailVerifiedAt',
  'id',
  'locale',
  'name',
  'phone',
  'phoneVerifiedAt',
].sort()

const ADMIN_FIELDS = [...SELF_FIELDS, 'isActive', 'lastLoginAt'].sort()

describe('用户响应契约(自助视角)', () => {
  test('UserResponseSchema 只暴露自助资料字段', () => {
    expect(keysOf(UserResponseSchema).sort()).toEqual(SELF_FIELDS)
    expect(keysOf(UserResponseSchema)).not.toContain('passwordHash')
    expect(keysOf(UserResponseSchema)).not.toContain('isActive')
    expect(keysOf(UserResponseSchema)).not.toContain('lastLoginAt')
  })

  test('AuthUserResponseSchema = 自助资料 + roles/permissions', () => {
    expect(keysOf(AuthUserResponseSchema).sort()).toEqual(
      [...SELF_FIELDS, 'permissions', 'roles'].sort(),
    )
  })
})

describe('用户响应契约(管理视角)', () => {
  test('AdminUserResponseSchema 在自助字段外增加管理字段', () => {
    expect(keysOf(AdminUserResponseSchema).sort()).toEqual(ADMIN_FIELDS)
    expect(keysOf(AdminUserResponseSchema)).not.toContain('passwordHash')
  })

  test('AdminAuthUserResponseSchema = 管理资料 + roles/permissions', () => {
    expect(keysOf(AdminAuthUserResponseSchema).sort()).toEqual(
      [...ADMIN_FIELDS, 'permissions', 'roles'].sort(),
    )
  })

  test('AdminUserWithRolesResponseSchema = 管理资料 + roles', () => {
    expect(keysOf(AdminUserWithRolesResponseSchema).sort()).toEqual(
      [...ADMIN_FIELDS, 'roles'].sort(),
    )
  })
})

describe('RegisterInputSchema', () => {
  test('只接受 name/email/password 三个字段', () => {
    expect(keysOf(RegisterInputSchema).sort()).toEqual(['email', 'name', 'password'])
  })

  test('复用 emailSchema 的归一化(小写)', () => {
    const input = Value.Decode(RegisterInputSchema, {
      name: 'Alice',
      email: 'Alice@Example.COM',
      password: 'password123',
    })

    expect(input.name).toBe('Alice')
    expect(input.email).toBe('alice@example.com')
  })
})
