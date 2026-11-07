import type { Static } from '@sinclair/typebox'
import { type DbClient, schema, withTransaction } from '@yongstack/database'
import { recordOutboxEvent } from '@yongstack/outbox'
import { assignDefaultRole } from '@yongstack/rbac'
import { err, ok, type Result } from '@yongstack/shared'
import {
  changePassword as changeUserPassword,
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  createPasswordResetToken,
  getUserById,
  registerUser,
  type RegisterUserError,
  type TokenError,
  type UserError,
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
    const locale = user.locale
    await assignDefaultRole(user.id, tx)
    const { token } = await createEmailVerificationToken(user.id, tx)

    await recordOutboxEvent(tx, {
      type: USER_REGISTERED_EVENT,
      payload: {
        userId: user.id,
        email: user.email,
        name: user.name,
        locale,
      },
    })
    await recordVerificationEmail(user, token, locale, tx)
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
  if (user.emailVerifiedAt !== null) return ok(null)

  return withTransaction(client, async (tx) => {
    const { token } = await createEmailVerificationToken(user.id, tx)
    await recordVerificationEmail(user, token, opts.locale ?? user.locale, tx)
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
