import type { Static } from '@sinclair/typebox'
import { recordAudit } from '@yongstack/audit'
import { type DbClient, withTransaction } from '@yongstack/database'
import {
  EMAIL_VERIFICATION_REQUESTED_EVENT,
  recordOutboxEvent,
  USER_REGISTERED_EVENT,
} from '@yongstack/outbox'
import { ADMIN_ROLE_CODE, assignDefaultRole, getUserAccess, type UserAccess } from '@yongstack/rbac'
import { isEmailVerificationRequired } from '@yongstack/settings'
import { err, InvariantViolation, ok, type Result } from '@yongstack/shared'
import {
  type CodeRequestedTooSoonError,
  createEmailVerificationToken,
  createPhoneUser,
  findUserByPhone,
  loginUser,
  type LoginUserError,
  markPhoneVerified,
  type PhoneVerifyCodeError,
  registerUser,
  type RegisterUserError,
  requestPhoneLoginCode,
  updateLastLogin,
  updateUserLocale,
  type User,
  verifyPhoneLoginCode,
} from '@yongstack/user'
import type { LoginInputSchema, RegisterInputSchema } from '@yongstack/user/model'

// 审计/会话等边缘上下文: 由 apps(presentation) 用 requestMeta() 提取后以纯数据传入,
// 本用例不 import 任何 infrastructure 包。
export type ActorMeta = {
  ip: string | null
  userAgent: string | null
  requestId: string | null
}

export type AuthenticatedAccess = {
  user: User
  access: UserAccess
}

export type LoginFlowError = LoginUserError | 'EMAIL_NOT_VERIFIED'
export type AdminLoginFlowError = LoginUserError | 'FORBIDDEN'
export type PhoneLoginFlowError =
  PhoneVerifyCodeError | 'ACCOUNT_DISABLED' | 'PHONE_ALREADY_IN_USE' | 'USER_NOT_FOUND'
export type AdminPhoneLoginFlowError =
  PhoneVerifyCodeError | 'PHONE_NOT_REGISTERED' | 'ACCOUNT_DISABLED' | 'FORBIDDEN'
export type { CodeRequestedTooSoonError }

// app 端注册: 建号 + 默认角色 + 欢迎邮件/验证邮件事件(同事务) + 最近登录。
// 会话签发(cookie/redis)留在 apps, 这里只产出用户与访问上下文。
export async function registerAccount(
  input: Static<typeof RegisterInputSchema>,
  client: DbClient,
  opts: { locale?: string } = {},
): Promise<Result<AuthenticatedAccess, RegisterUserError>> {
  const created = await withTransaction(client, async (tx) => {
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
    await recordOutboxEvent(tx, {
      type: EMAIL_VERIFICATION_REQUESTED_EVENT,
      payload: {
        userId: user.id,
        email,
        name: user.name,
        token,
        locale,
      },
    })
    const access = await getUserAccess(user.id, tx)
    return ok({ user, access })
  })
  if (created.isErr()) return created

  const { user, access } = created.value
  await updateLastLogin(user.id, client)
  user.lastLoginAt = new Date()
  return ok({ user, access })
}

// app 端邮箱密码登录: 校验 → 邮箱验证策略 → 角色权限 → 语言/最近登录。
export async function loginWithPassword(
  input: Static<typeof LoginInputSchema>,
  opts: { client: DbClient; locale?: string },
): Promise<Result<AuthenticatedAccess, LoginFlowError>> {
  const { client, locale } = opts
  const result = await loginUser(input, client)
  if (result.isErr()) return err(result.error)
  const user = result.value
  // 用户体验开关在 settings 域: 开启时未验证邮箱禁止登录
  if ((await isEmailVerificationRequired(client)) && user.emailVerifiedAt === null) {
    return err('EMAIL_NOT_VERIFIED')
  }

  const access = await getUserAccess(user.id, client)
  if (locale !== undefined && locale !== user.locale) {
    await updateUserLocale(user.id, locale, client)
    user.locale = locale
  }
  await updateLastLogin(user.id, client)
  user.lastLoginAt = new Date()
  return ok({ user, access })
}

// admin 端邮箱密码登录: 校验 → admin 角色检查 → 审计(成功/失败均记)。
export async function loginAdminWithPassword(
  input: Static<typeof LoginInputSchema>,
  opts: { client: DbClient; actorMeta: ActorMeta },
): Promise<Result<AuthenticatedAccess, AdminLoginFlowError>> {
  const { client, actorMeta } = opts
  const result = await loginUser(input, client)
  if (result.isErr()) {
    // 登录失败无法定位 actor, 只记录尝试的邮箱
    await recordAudit(
      {
        action: 'admin.login.failure',
        targetType: 'user',
        diff: { email: input.email, reason: result.error },
        ...actorMeta,
      },
      client,
    )
    return err(result.error)
  }

  const user = result.value
  const access = await getUserAccess(user.id, client)
  if (!access.roles.includes(ADMIN_ROLE_CODE)) {
    await recordAudit(
      {
        action: 'admin.login.failure',
        targetType: 'user',
        diff: { email: input.email, reason: 'FORBIDDEN' },
        ...actorMeta,
      },
      client,
    )
    return err('FORBIDDEN')
  }

  await recordAudit(
    {
      actorId: user.id,
      action: 'admin.login.success',
      targetType: 'user',
      targetId: user.id,
      ...actorMeta,
    },
    client,
  )
  return ok({ user, access })
}

// app 端验证码登录: 手机号不存在时自动注册为 member。
// 注意 OTP 校验必须在事务外完成: 失败时 attempts 自增必须落库, 不能被回滚。
export async function loginWithPhone(
  phoneInput: string,
  code: string,
  opts: { client: DbClient; secret: string; verifiedPhone?: string; locale?: string },
): Promise<Result<AuthenticatedAccess, PhoneLoginFlowError>> {
  const { client, secret, locale } = opts
  const verified = await verifyPhoneLoginCode(phoneInput, code, secret, client)
  if (verified.isErr()) return err(verified.error)

  const phone = verified.value.phone
  const user = await withTransaction(client, async (tx) => {
    let found = await findUserByPhone(phone, tx)
    if (!found) {
      const created = await createPhoneUser(phone, tx, locale === undefined ? {} : { locale })
      if (created) {
        found = created
        await assignDefaultRole(found.id, tx)
      } else {
        // 并发首次登录: 另一个请求已建号
        found = await findUserByPhone(phone, tx)
        if (!found) return err('PHONE_ALREADY_IN_USE')
      }
    }

    if (!found.isActive) return err('ACCOUNT_DISABLED')
    if (found.phoneVerifiedAt === null) {
      const marked = await markPhoneVerified(found.id, phone, tx)
      if (marked.isErr()) return err('USER_NOT_FOUND')
    }
    return ok(found)
  })
  if (user.isErr()) return err(user.error)

  const access = await getUserAccess(user.value.id, client)
  await updateLastLogin(user.value.id, client)
  return ok({ user: user.value, access })
}

// admin 端验证码登录: 仅已绑定手机号且角色为 admin 的账号; 不自动注册。
export async function requestAdminLoginPhoneCode(
  phone: string,
  client: DbClient,
  opts: { secret: string; fixedCode?: string },
): Promise<Result<{ code: string } | null, CodeRequestedTooSoonError | 'CODE_RATE_LIMITED'>> {
  const user = await findUserByPhone(phone, client)
  if (!user || user.phoneVerifiedAt === null) return ok(null)

  const access = await getUserAccess(user.id, client)
  if (!access.roles.includes(ADMIN_ROLE_CODE)) return ok(null)

  return requestPhoneLoginCode(
    phone,
    opts.secret,
    client,
    opts.fixedCode === undefined ? {} : { fixedCode: opts.fixedCode },
  )
}

export async function loginAdminWithPhone(
  phoneInput: string,
  code: string,
  opts: { client: DbClient; secret: string },
): Promise<Result<AuthenticatedAccess, AdminPhoneLoginFlowError>> {
  const { client, secret } = opts
  const verified = await verifyPhoneLoginCode(phoneInput, code, secret, client)
  if (verified.isErr()) return err(verified.error)

  const user = await findUserByPhone(verified.value.phone, client)
  if (!user || user.phoneVerifiedAt === null) return err('PHONE_NOT_REGISTERED')
  if (!user.isActive) return err('ACCOUNT_DISABLED')

  const access = await getUserAccess(user.id, client)
  if (!access.roles.includes(ADMIN_ROLE_CODE)) return err('FORBIDDEN')
  return ok({ user, access })
}
