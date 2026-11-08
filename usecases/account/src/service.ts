import type { Static } from '@sinclair/typebox'
import { type DbClient, schema, withTransaction } from '@yongstack/database'
import { recordOutboxEvent } from '@yongstack/outbox'
import { assignDefaultRole, getUserAccess } from '@yongstack/rbac'
import { err, InvariantViolation, ok, type Result } from '@yongstack/shared'
import {
  bindPhone as bindUserPhone,
  changePassword as changeUserPassword,
  type CodeRequestedTooSoonError,
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  createPasswordResetToken,
  createPhoneUser,
  findUserByPhone,
  getUserById,
  markPhoneVerified,
  type PhoneUserError,
  registerUser,
  type RegisterUserError,
  requestPhoneLoginCode as requestUserPhoneLoginCode,
  type TokenError,
  unbindPhone as unbindUserPhone,
  type UserError,
  verifyPhoneLoginCode,
} from '@yongstack/user'
import type {
  ChangePasswordInputSchema,
  RegisterInputSchema,
  ResetPasswordInputSchema,
  VerifyEmailInputSchema,
} from '@yongstack/user/model'

export const USER_REGISTERED_EVENT = 'user.registered'
export const EMAIL_VERIFICATION_REQUESTED_EVENT = 'user.email_verification_requested'
export const PASSWORD_RESET_REQUESTED_EVENT = 'user.password_reset_requested'

export type PhoneVerifyCodeError = 'CODE_INVALID' | 'CODE_EXPIRED' | 'CODE_ATTEMPTS_EXCEEDED'
export type PhoneLoginError =
  PhoneVerifyCodeError | 'ACCOUNT_DISABLED' | 'PHONE_ALREADY_IN_USE' | 'USER_NOT_FOUND'
export type AdminPhoneLoginError =
  PhoneVerifyCodeError | 'PHONE_NOT_REGISTERED' | 'ACCOUNT_DISABLED' | 'FORBIDDEN'
export type PhoneBindError = PhoneVerifyCodeError | PhoneUserError

async function recordVerificationEmail(
  user: { id: string; email: string; name: string | null },
  token: string,
  locale: string,
  client: DbClient,
): Promise<void> {
  await recordOutboxEvent(client, {
    type: EMAIL_VERIFICATION_REQUESTED_EVENT,
    payload: {
      userId: user.id,
      email: user.email,
      name: user.name,
      token,
      locale,
    },
  })
}

export async function registerAccount(
  input: Static<typeof RegisterInputSchema>,
  client: DbClient,
  opts: { locale?: string } = {},
): Promise<Result<typeof schema.users.$inferSelect, RegisterUserError>> {
  return withTransaction(client, async (tx) => {
    const result = await registerUser(input, tx, opts)
    if (result.isErr()) return err(result.error)

    const user = result.value
    const email = user.email
    if (email === null) throw new InvariantViolation('registered user missing email')
    const locale = user.locale
    await assignDefaultRole(user.id, tx)
    const { token } = await createEmailVerificationToken(user.id, tx)

    await recordOutboxEvent(tx, {
      type: USER_REGISTERED_EVENT,
      payload: {
        userId: user.id,
        email,
        name: user.name,
        locale,
      },
    })
    await recordVerificationEmail({ id: user.id, email, name: user.name }, token, locale, tx)
    return ok(user)
  })
}

export async function requestEmailVerification(
  userId: string,
  client: DbClient,
  opts: { locale?: string } = {},
): Promise<Result<{ token: string } | null, UserError>> {
  const found = await getUserById(userId, client)
  if (found.isErr()) return err(found.error)
  const user = found.value
  const email = user.email
  // 手机号自动注册的账号没有邮箱, 无需验证
  if (email === null || user.emailVerifiedAt !== null) return ok(null)

  return withTransaction(client, async (tx) => {
    const { token } = await createEmailVerificationToken(user.id, tx)
    await recordVerificationEmail(
      { id: user.id, email, name: user.name },
      token,
      opts.locale ?? user.locale,
      tx,
    )
    return ok({ token })
  })
}

export async function verifyEmail(
  input: Static<typeof VerifyEmailInputSchema>,
  client: DbClient,
): Promise<Result<{ userId: string }, TokenError>> {
  return consumeEmailVerificationToken(input, client)
}

export async function requestPasswordReset(
  email: string,
  client: DbClient,
  opts: { locale?: string } = {},
): Promise<Result<{ token: string } | null, never>> {
  return withTransaction(client, async (tx) => {
    const created = await createPasswordResetToken(email, tx)
    if (created === null) return ok(null)

    await recordOutboxEvent(tx, {
      type: PASSWORD_RESET_REQUESTED_EVENT,
      payload: {
        email,
        token: created.token,
        locale: opts.locale ?? 'en',
      },
    })
    return ok(created)
  })
}

export async function resetPassword(
  input: Static<typeof ResetPasswordInputSchema>,
  client: DbClient,
): Promise<Result<{ userId: string }, TokenError>> {
  return consumePasswordResetToken(input, client)
}

export async function changePassword(
  userId: string,
  input: Static<typeof ChangePasswordInputSchema>,
  client: DbClient,
): Promise<Result<{ userId: string }, 'LOGIN_FAILED'>> {
  return changeUserPassword(userId, input, client)
}

export async function requestPhoneLoginCode(
  phone: string,
  client: DbClient,
  opts: { secret: string; fixedCode?: string },
): Promise<Result<{ code: string }, CodeRequestedTooSoonError | 'CODE_RATE_LIMITED'>> {
  return requestUserPhoneLoginCode(
    phone,
    opts.secret,
    client,
    opts.fixedCode === undefined ? {} : { fixedCode: opts.fixedCode },
  )
}

// app 端验证码登录: 手机号不存在时自动注册为 member。
// OTP 校验必须在事务外完成, 否则失败时的 attempts 自增会被回滚。
export async function verifyPhoneLogin(
  phone: string,
  code: string,
  client: DbClient,
  opts: { secret: string; locale?: string },
): Promise<Result<{ userId: string }, PhoneLoginError>> {
  const verified = await verifyPhoneLoginCode(phone, code, opts.secret, client)
  if (verified.isErr()) return err(verified.error)

  return withTransaction(client, async (tx) => {
    let user = await findUserByPhone(phone, tx)
    if (!user) {
      const created = await createPhoneUser(
        phone,
        tx,
        opts.locale === undefined ? {} : { locale: opts.locale },
      )
      if (created) {
        user = created
        await assignDefaultRole(user.id, tx)
      } else {
        // 并发首次登录: 另一个请求已建号
        user = await findUserByPhone(phone, tx)
        if (!user) return err('PHONE_ALREADY_IN_USE')
      }
    }

    if (!user.isActive) return err('ACCOUNT_DISABLED')
    if (user.phoneVerifiedAt === null) {
      const marked = await markPhoneVerified(user.id, phone, tx)
      if (marked.isErr()) return err('USER_NOT_FOUND')
    }
    return ok({ userId: user.id })
  })
}

// admin 端: 仅已绑定手机号且角色为 admin 的账号会收到验证码; 不自动注册。
export async function requestAdminPhoneLoginCode(
  phone: string,
  client: DbClient,
  opts: { secret: string; fixedCode?: string },
): Promise<Result<{ code: string } | null, CodeRequestedTooSoonError | 'CODE_RATE_LIMITED'>> {
  const user = await findUserByPhone(phone, client)
  if (!user || user.phoneVerifiedAt === null) return ok(null)

  const access = await getUserAccess(user.id, client)
  if (!access.roles.includes('admin')) return ok(null)

  return requestUserPhoneLoginCode(
    phone,
    opts.secret,
    client,
    opts.fixedCode === undefined ? {} : { fixedCode: opts.fixedCode },
  )
}

export async function verifyAdminPhoneLogin(
  phone: string,
  code: string,
  client: DbClient,
  opts: { secret: string },
): Promise<Result<{ userId: string }, AdminPhoneLoginError>> {
  const verified = await verifyPhoneLoginCode(phone, code, opts.secret, client)
  if (verified.isErr()) return err(verified.error)

  const user = await findUserByPhone(phone, client)
  if (!user || user.phoneVerifiedAt === null) return err('PHONE_NOT_REGISTERED')
  if (!user.isActive) return err('ACCOUNT_DISABLED')

  const access = await getUserAccess(user.id, client)
  if (!access.roles.includes('admin')) return err('FORBIDDEN')
  return ok({ userId: user.id })
}

export async function requestPhoneBindCode(
  userId: string,
  phone: string,
  client: DbClient,
  opts: { secret: string; fixedCode?: string },
): Promise<
  Result<{ code: string }, CodeRequestedTooSoonError | 'CODE_RATE_LIMITED' | 'PHONE_ALREADY_IN_USE'>
> {
  const existing = await findUserByPhone(phone, client)
  if (existing && existing.id !== userId) return err('PHONE_ALREADY_IN_USE')

  return requestUserPhoneLoginCode(
    phone,
    opts.secret,
    client,
    opts.fixedCode === undefined ? {} : { fixedCode: opts.fixedCode },
  )
}

export async function bindPhone(
  userId: string,
  phone: string,
  code: string,
  client: DbClient,
  opts: { secret: string },
): Promise<Result<{ userId: string }, PhoneBindError>> {
  const verified = await verifyPhoneLoginCode(phone, code, opts.secret, client)
  if (verified.isErr()) return err(verified.error)

  return withTransaction(client, async (tx) => {
    const bound = await bindUserPhone(userId, phone, tx)
    if (bound.isErr()) return err(bound.error)
    return ok({ userId })
  })
}

export async function unbindPhone(
  userId: string,
  client: DbClient,
): Promise<Result<{ userId: string }, PhoneUserError>> {
  return unbindUserPhone(userId, client)
}
