import { createHash, randomBytes } from 'node:crypto'

import type { Static } from '@sinclair/typebox'
import { type DbClient, schema, withTransaction } from '@yongstack/database'
import { err, hashPassword, ok, type Result, verifyPassword } from '@yongstack/shared'
import { and, count, desc, eq, ilike, or } from 'drizzle-orm'

import type {
  ChangePasswordInputSchema,
  LoginInputSchema,
  RegisterInputSchema,
  ResetPasswordInputSchema,
  UpdateProfileInputSchema,
  UpdateUserInputSchema,
  UserListQuerySchema,
  VerifyEmailInputSchema,
} from './model'

export type RegisterUserError = 'EMAIL_ALREADY_REGISTERED'
export type LoginUserError = 'LOGIN_FAILED' | 'ACCOUNT_DISABLED'
export type UserError = 'USER_NOT_FOUND'
export type TokenError = 'TOKEN_INVALID' | 'TOKEN_EXPIRED'

type User = typeof schema.users.$inferSelect

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000

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

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function newToken(): string {
  return randomBytes(32).toString('hex')
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

export async function updateUserStatus(
  id: string,
  input: Static<typeof UpdateUserInputSchema>,
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

export async function listUsers(opts: Static<typeof UserListQuerySchema>, client: DbClient) {
  const { page, pageSize, q, isActive } = opts
  const conditions = []
  if (q !== undefined && q.trim().length > 0) {
    const pattern = `%${q.trim()}%`
    conditions.push(or(ilike(schema.users.email, pattern), ilike(schema.users.name, pattern)))
  }
  if (isActive !== undefined) conditions.push(eq(schema.users.isActive, isActive))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await client
    .select()
    .from(schema.users)
    .where(where)
    .orderBy(desc(schema.users.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
  const [{ total }] = await client.select({ total: count() }).from(schema.users).where(where)
  return { items: rows, total: Number(total), page, pageSize }
}

export async function updateLastLogin(id: string, client: DbClient): Promise<void> {
  await client.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, id))
}

// 语言偏好持久化(注册/登录时从请求语言落库): 邮件等异步通知按用户语言渲染。
export async function updateUserLocale(
  id: string,
  locale: string,
  client: DbClient,
): Promise<void> {
  await client.update(schema.users).set({ locale }).where(eq(schema.users.id, id))
}

export async function createEmailVerificationToken(
  userId: string,
  client: DbClient,
): Promise<{ token: string }> {
  const token = newToken()
  await client.insert(schema.emailVerificationTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  })
  return { token }
}

export async function consumeEmailVerificationToken(
  input: Static<typeof VerifyEmailInputSchema>,
  client: DbClient,
): Promise<Result<{ userId: string }, TokenError>> {
  const [row] = await client
    .select()
    .from(schema.emailVerificationTokens)
    .where(eq(schema.emailVerificationTokens.tokenHash, hashToken(input.token)))
  if (!row || row.usedAt) return err('TOKEN_INVALID')
  if (row.expiresAt.getTime() < Date.now()) return err('TOKEN_EXPIRED')

  return withTransaction(client, async (tx) => {
    await tx
      .update(schema.users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(schema.users.id, row.userId))
    await tx
      .update(schema.emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(schema.emailVerificationTokens.id, row.id))
    return ok({ userId: row.userId })
  })
}

export async function createPasswordResetToken(
  email: string,
  client: DbClient,
): Promise<{ token: string } | null> {
  const [user] = await client
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, normalizeEmail(email)))
  if (!user) return null

  const token = newToken()
  await client.insert(schema.passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  })
  return { token }
}

export async function consumePasswordResetToken(
  input: Static<typeof ResetPasswordInputSchema>,
  client: DbClient,
): Promise<Result<{ userId: string }, TokenError>> {
  const [row] = await client
    .select()
    .from(schema.passwordResetTokens)
    .where(eq(schema.passwordResetTokens.tokenHash, hashToken(input.token)))
  if (!row || row.usedAt) return err('TOKEN_INVALID')
  if (row.expiresAt.getTime() < Date.now()) return err('TOKEN_EXPIRED')

  return withTransaction(client, async (tx) => {
    const passwordHash = await hashPassword(input.password)
    await tx.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, row.userId))
    await tx
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(schema.passwordResetTokens.id, row.id))
    return ok({ userId: row.userId })
  })
}

export async function changePassword(
  userId: string,
  input: Static<typeof ChangePasswordInputSchema>,
  client: DbClient,
): Promise<Result<{ userId: string }, 'LOGIN_FAILED'>> {
  const [user] = await client.select().from(schema.users).where(eq(schema.users.id, userId))
  if (!user) return err('LOGIN_FAILED')
  const valid = await verifyPassword(input.currentPassword, user.passwordHash)
  if (!valid) return err('LOGIN_FAILED')

  const passwordHash = await hashPassword(input.newPassword)
  await client.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, userId))
  return ok({ userId })
}
