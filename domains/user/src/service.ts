import type { Static } from '@sinclair/typebox'
import { type DbClient, schema } from '@yongstack/database'
import { err, hashPassword, ok, type Result, verifyPassword } from '@yongstack/shared'
import { eq } from 'drizzle-orm'

import type { LoginInputSchema, RegisterInputSchema, UpdateProfileInputSchema } from './model'

export type RegisterUserError = 'EMAIL_ALREADY_REGISTERED'
export type LoginUserError = 'LOGIN_FAILED' | 'ACCOUNT_DISABLED'
export type UserError = 'USER_NOT_FOUND'

type User = typeof schema.users.$inferSelect

// Postgres unique_violation: 预检查 + 并发插入兜底
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  )
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

let dummyHash: string | null = null

async function getDummyHash(): Promise<string> {
  if (!dummyHash) dummyHash = await hashPassword('yongstack-dummy-password')
  return dummyHash
}

export async function registerUser(
  input: Static<typeof RegisterInputSchema>,
  client: DbClient,
  opts: { locale?: string } = {},
): Promise<Result<User, RegisterUserError>> {
  const email = normalizeEmail(input.email)
  const [existing] = await client
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
  if (existing) return err('EMAIL_ALREADY_REGISTERED')

  const passwordHash = await hashPassword(input.password)
  try {
    const [user] = await client
      .insert(schema.users)
      .values({
        name: input.name,
        email,
        passwordHash,
        phone: input.phone ?? null,
        locale: opts.locale ?? 'en',
      })
      .returning()
    return ok(user)
  } catch (error) {
    // 并发注册同一邮箱: 唯一约束兜底, 仍返回业务错误而不是 500
    if (isUniqueViolation(error)) return err('EMAIL_ALREADY_REGISTERED')
    throw error
  }
}

export async function loginUser(
  input: Static<typeof LoginInputSchema>,
  client: DbClient,
): Promise<Result<User, LoginUserError>> {
  const email = normalizeEmail(input.email)
  const [user] = await client.select().from(schema.users).where(eq(schema.users.email, email))
  if (!user) {
    // 邮箱不存在也做一次哈希校验, 避免时序差异泄露注册状态
    await verifyPassword(input.password, await getDummyHash())
    return err('LOGIN_FAILED')
  }
  const valid = await verifyPassword(input.password, user.passwordHash)
  if (!valid) return err('LOGIN_FAILED')
  if (!user.isActive) return err('ACCOUNT_DISABLED')
  return ok(user)
}

export async function getUserById(id: string, client: DbClient): Promise<Result<User, UserError>> {
  const [user] = await client.select().from(schema.users).where(eq(schema.users.id, id))
  if (!user) return err('USER_NOT_FOUND')
  return ok(user)
}

export async function updateProfile(
  id: string,
  input: Static<typeof UpdateProfileInputSchema>,
  client: DbClient,
): Promise<Result<User, UserError>> {
  const [updated] = await client
    .update(schema.users)
    .set(input)
    .where(eq(schema.users.id, id))
    .returning()
  if (!updated) return err('USER_NOT_FOUND')
  return ok(updated)
}

// 语言偏好持久化(注册/登录时从请求语言落库): 邮件等异步通知按用户语言渲染。
export async function updateUserLocale(
  id: string,
  locale: string,
  client: DbClient,
): Promise<void> {
  await client.update(schema.users).set({ locale }).where(eq(schema.users.id, id))
}
