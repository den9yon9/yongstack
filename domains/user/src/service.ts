import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

import type { Static } from '@sinclair/typebox'
import { type DbClient, schema, withTransaction } from '@yongstack/database'
import { DomainError, err, hashPassword, ok, type Result, verifyPassword } from '@yongstack/shared'
import { and, count, desc, eq, gt, ilike, isNull, ne, or, sql } from 'drizzle-orm'

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

export class CodeRequestedTooSoonError extends DomainError<'CODE_REQUESTED_TOO_SOON'> {
  readonly code = 'CODE_REQUESTED_TOO_SOON' as const

  constructor(readonly retryAfterSeconds: number) {
    super(`Verification code requested too soon; retry after ${retryAfterSeconds}s`)
  }

  toJSON(): {
    code: 'CODE_REQUESTED_TOO_SOON'
    message: string
    retryAfterSeconds: number
  } {
    return { ...super.toJSON(), retryAfterSeconds: this.retryAfterSeconds }
  }
}

export type PhoneCodeRequestError = CodeRequestedTooSoonError | 'CODE_RATE_LIMITED'
export type PhoneVerifyCodeError = 'CODE_INVALID' | 'CODE_EXPIRED' | 'CODE_ATTEMPTS_EXCEEDED'
export type PhoneCodeError = PhoneCodeRequestError | PhoneVerifyCodeError
export type PhoneUserError = 'USER_NOT_FOUND' | 'PHONE_ALREADY_IN_USE' | 'CANNOT_UNBIND_ONLY_LOGIN'

type User = typeof schema.users.$inferSelect

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000
const PHONE_CODE_TTL_MS = 5 * 60 * 1000
const PHONE_CODE_RESEND_COOLDOWN_MS = 60 * 1000
const PHONE_CODE_HOURLY_LIMIT = 5
const PHONE_CODE_MAX_ATTEMPTS = 5

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
  // 手机号自动注册的账号没有密码, 不允许邮箱密码登录
  if (user.passwordHash === null) {
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
    conditions.push(
      or(
        ilike(schema.users.email, pattern),
        ilike(schema.users.name, pattern),
        ilike(schema.users.phone, pattern),
      ),
    )
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
  if (!user || user.passwordHash === null) return err('LOGIN_FAILED')
  const valid = await verifyPassword(input.currentPassword, user.passwordHash)
  if (!valid) return err('LOGIN_FAILED')

  const passwordHash = await hashPassword(input.newPassword)
  await client.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, userId))
  return ok({ userId })
}

function normalizePhone(phone: string): string {
  return phone.trim()
}

function hashPhoneCode(phone: string, code: string, secret: string): string {
  return createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex')
}

function newPhoneCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export async function requestPhoneLoginCode(
  phoneInput: string,
  secret: string,
  client: DbClient,
  opts: { fixedCode?: string } = {},
): Promise<Result<{ code: string }, PhoneCodeRequestError>> {
  const phone = normalizePhone(phoneInput)
  const now = new Date()

  // 冷却/限额检查与插入同事务, 并对手机号取 advisory lock 先串行化:
  // 检查-插入之间的竞态(尤其该手机号没有任何历史记录时无行可锁)由此消除,
  // 并发请求必然一个先提交、另一个在锁上等待后看到最新记录。
  return withTransaction(client, async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${phone}))`)

    const [latest] = await tx
      .select({ createdAt: schema.phoneLoginCodes.createdAt })
      .from(schema.phoneLoginCodes)
      .where(eq(schema.phoneLoginCodes.phone, phone))
      .orderBy(desc(schema.phoneLoginCodes.createdAt))
      .limit(1)
    if (latest) {
      const elapsed = now.getTime() - latest.createdAt.getTime()
      if (elapsed < PHONE_CODE_RESEND_COOLDOWN_MS) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((PHONE_CODE_RESEND_COOLDOWN_MS - elapsed) / 1000),
        )
        return err(new CodeRequestedTooSoonError(retryAfterSeconds))
      }
    }

    const [{ total }] = await tx
      .select({ total: count() })
      .from(schema.phoneLoginCodes)
      .where(
        and(
          eq(schema.phoneLoginCodes.phone, phone),
          gt(schema.phoneLoginCodes.createdAt, new Date(now.getTime() - 60 * 60 * 1000)),
        ),
      )
    if (Number(total) >= PHONE_CODE_HOURLY_LIMIT) return err('CODE_RATE_LIMITED')

    const code = opts.fixedCode ?? newPhoneCode()
    const codeHash = hashPhoneCode(phone, code, secret)

    // 新码作废旧码, 避免同一手机号存在多个有效验证码
    await tx
      .update(schema.phoneLoginCodes)
      .set({ consumedAt: now })
      .where(
        and(eq(schema.phoneLoginCodes.phone, phone), isNull(schema.phoneLoginCodes.consumedAt)),
      )
    await tx.insert(schema.phoneLoginCodes).values({
      phone,
      codeHash,
      expiresAt: new Date(now.getTime() + PHONE_CODE_TTL_MS),
    })
    return ok({ code })
  })
}

async function consumePhoneLoginCode(id: string, client: DbClient): Promise<void> {
  await client
    .update(schema.phoneLoginCodes)
    .set({ consumedAt: new Date() })
    .where(eq(schema.phoneLoginCodes.id, id))
}

async function incrementPhoneCodeAttempts(id: string, client: DbClient): Promise<number> {
  const [row] = await client
    .update(schema.phoneLoginCodes)
    .set({ attempts: sql`${schema.phoneLoginCodes.attempts} + 1` })
    .where(eq(schema.phoneLoginCodes.id, id))
    .returning({ attempts: schema.phoneLoginCodes.attempts })
  return row?.attempts ?? 0
}

// 校验 OTP。注意不能包在 withTransaction 里: 失败时 attempts 自增必须落库。
export async function verifyPhoneLoginCode(
  phoneInput: string,
  code: string,
  secret: string,
  client: DbClient,
): Promise<Result<{ phone: string }, PhoneVerifyCodeError>> {
  const phone = normalizePhone(phoneInput)
  const [row] = await client
    .select()
    .from(schema.phoneLoginCodes)
    .where(and(eq(schema.phoneLoginCodes.phone, phone), isNull(schema.phoneLoginCodes.consumedAt)))
    .orderBy(desc(schema.phoneLoginCodes.createdAt))
    .limit(1)
  if (!row) return err('CODE_INVALID')
  if (row.expiresAt.getTime() <= Date.now()) {
    await consumePhoneLoginCode(row.id, client)
    return err('CODE_EXPIRED')
  }

  const actual = hashPhoneCode(phone, code, secret)
  const valid =
    row.codeHash.length === actual.length &&
    timingSafeEqual(Buffer.from(row.codeHash), Buffer.from(actual))
  if (!valid) {
    const attempts = await incrementPhoneCodeAttempts(row.id, client)
    if (attempts >= PHONE_CODE_MAX_ATTEMPTS) {
      await consumePhoneLoginCode(row.id, client)
      return err('CODE_ATTEMPTS_EXCEEDED')
    }
    return err('CODE_INVALID')
  }

  await consumePhoneLoginCode(row.id, client)
  return ok({ phone })
}

export async function findUserByPhone(phoneInput: string, client: DbClient): Promise<User | null> {
  const [user] = await client
    .select()
    .from(schema.users)
    .where(eq(schema.users.phone, normalizePhone(phoneInput)))
  return user ?? null
}

// 手机号验证码首次登录自动建号: 无邮箱/无密码, 手机号已验证。
export async function createPhoneUser(
  phoneInput: string,
  client: DbClient,
  opts: { locale?: string } = {},
): Promise<User | null> {
  const [user] = await client
    .insert(schema.users)
    .values({
      phone: normalizePhone(phoneInput),
      phoneVerifiedAt: new Date(),
      locale: opts.locale ?? 'en',
    })
    .onConflictDoNothing({ target: schema.users.phone })
    .returning()
  return user ?? null
}

export async function markPhoneVerified(
  userId: string,
  phoneInput: string,
  client: DbClient,
): Promise<Result<User, UserError>> {
  const [user] = await client
    .update(schema.users)
    .set({ phone: normalizePhone(phoneInput), phoneVerifiedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning()
  if (!user) return err('USER_NOT_FOUND')
  return ok(user)
}

export async function bindPhone(
  userId: string,
  phoneInput: string,
  client: DbClient,
): Promise<Result<User, PhoneUserError>> {
  const phone = normalizePhone(phoneInput)
  const [existing] = await client
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.phone, phone), ne(schema.users.id, userId)))
  if (existing) return err('PHONE_ALREADY_IN_USE')

  try {
    const [user] = await client
      .update(schema.users)
      .set({ phone, phoneVerifiedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning()
    if (!user) return err('USER_NOT_FOUND')
    return ok(user)
  } catch (error) {
    if (isUniqueViolation(error)) return err('PHONE_ALREADY_IN_USE')
    throw error
  }
}

export async function unbindPhone(
  userId: string,
  client: DbClient,
): Promise<Result<{ userId: string }, PhoneUserError>> {
  const [user] = await client.select().from(schema.users).where(eq(schema.users.id, userId))
  if (!user) return err('USER_NOT_FOUND')
  // 防止把唯一登录方式解绑导致账号无法再登录
  if (user.email === null && user.passwordHash === null) return err('CANNOT_UNBIND_ONLY_LOGIN')

  await client
    .update(schema.users)
    .set({ phone: null, phoneVerifiedAt: null })
    .where(eq(schema.users.id, userId))
  return ok({ userId })
}
