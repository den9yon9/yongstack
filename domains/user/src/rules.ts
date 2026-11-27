// 纯业务规则(Functional Core): 不 import DB/HTTP/随机数, 只做决策。
// service.ts 负责取数/落库/哈希, 规则的可测试边界都在这里。

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000
export const PHONE_CODE_TTL_MS = 5 * 60 * 1000
export const PHONE_CODE_RESEND_COOLDOWN_MS = 60 * 1000
const PHONE_CODE_HOURLY_LIMIT = 5
const PHONE_CODE_MAX_ATTEMPTS = 5

export type ResendDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number }

// 冷却期内不允许重发; retryAfterSeconds 向上取整且至少 1 秒(与 429 Retry-After 语义一致)。
export function decidePhoneCodeResend(lastCreatedAt: Date | null, now: Date): ResendDecision {
  if (lastCreatedAt === null) return { allowed: true }

  const elapsed = now.getTime() - lastCreatedAt.getTime()
  if (elapsed >= PHONE_CODE_RESEND_COOLDOWN_MS) return { allowed: true }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((PHONE_CODE_RESEND_COOLDOWN_MS - elapsed) / 1000)),
  }
}

export function exceedsHourlyCodeLimit(total: number): boolean {
  return total >= PHONE_CODE_HOURLY_LIMIT
}

// 验证码用 <=: 到达 expiresAt 的那一刻即视为过期。
export function isPhoneCodeExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime()
}

export function exceedsMaxCodeAttempts(attempts: number): boolean {
  return attempts >= PHONE_CODE_MAX_ATTEMPTS
}

export type TokenUseDecision = 'OK' | 'TOKEN_INVALID' | 'TOKEN_EXPIRED'

// 已使用优先于过期: 用过的 token 一律 TOKEN_INVALID, 不泄露过期信息。
// 过期用 <: 恰好等于 expiresAt 仍可用(与原有实现一致)。
export function decideTokenUse(
  token: { usedAt: Date | null; expiresAt: Date },
  now: Date,
): TokenUseDecision {
  if (token.usedAt !== null) return 'TOKEN_INVALID'
  if (token.expiresAt.getTime() < now.getTime()) return 'TOKEN_EXPIRED'
  return 'OK'
}

// 邮箱/密码是仅剩的登录方式时, 不允许解绑手机号。
export function canUnbindPhone(user: {
  email: string | null
  passwordHash: string | null
}): boolean {
  return user.email !== null || user.passwordHash !== null
}
