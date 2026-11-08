import type { Static } from '@sinclair/typebox'
import { type DbClient, withTransaction } from '@yongstack/database'
import {
  EMAIL_VERIFICATION_REQUESTED_EVENT,
  PASSWORD_RESET_REQUESTED_EVENT,
  recordOutboxEvent,
} from '@yongstack/outbox'
import { err, ok, type Result } from '@yongstack/shared'
import {
  bindPhone as bindUserPhone,
  changePassword as changeUserPassword,
  type CodeRequestedTooSoonError,
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  createPasswordResetToken,
  findUserByPhone,
  getUserById,
  type PhoneUserError,
  type PhoneVerifyCodeError,
  requestPhoneLoginCode as requestUserPhoneLoginCode,
  type TokenError,
  unbindPhone as unbindUserPhone,
  type UserError,
  verifyPhoneLoginCode,
} from '@yongstack/user'
import type {
  ChangePasswordInputSchema,
  ResetPasswordInputSchema,
  VerifyEmailInputSchema,
} from '@yongstack/user/model'

export {
  EMAIL_VERIFICATION_REQUESTED_EVENT,
  PASSWORD_RESET_REQUESTED_EVENT,
} from '@yongstack/outbox'

export type PhoneBindError = PhoneVerifyCodeError | PhoneUserError

// 注册/登录的编排已收编到 usecases/auth;
// 本用例只负责账号生命周期: 邮箱验证、密码重置/修改、手机号绑定/解绑。

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
