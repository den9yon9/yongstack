import { describe, expect, test } from 'bun:test'

import {
  canUnbindPhone,
  decidePhoneCodeResend,
  decideTokenUse,
  exceedsHourlyCodeLimit,
  exceedsMaxCodeAttempts,
  isPhoneCodeExpired,
  PHONE_CODE_RESEND_COOLDOWN_MS,
} from './rules'

const now = new Date('2026-01-01T00:00:00.000Z')
const at = (offsetMs: number) => new Date(now.getTime() + offsetMs)

describe('decidePhoneCodeResend', () => {
  test('allows the first request', () => {
    expect(decidePhoneCodeResend(null, now)).toEqual({ allowed: true })
  })

  test('blocks inside the cooldown and rounds retryAfter up', () => {
    expect(decidePhoneCodeResend(at(-30_000), now)).toEqual({
      allowed: false,
      retryAfterSeconds: 30,
    })
    expect(decidePhoneCodeResend(at(-58_500), now)).toEqual({
      allowed: false,
      retryAfterSeconds: 2,
    })
  })

  test('allows exactly at the cooldown boundary', () => {
    expect(decidePhoneCodeResend(at(-PHONE_CODE_RESEND_COOLDOWN_MS), now)).toEqual({
      allowed: true,
    })
    expect(decidePhoneCodeResend(at(-PHONE_CODE_RESEND_COOLDOWN_MS - 1), now)).toEqual({
      allowed: true,
    })
  })

  test('handles clock skew (last request in the future) without underflowing', () => {
    const decision = decidePhoneCodeResend(at(5_000), now)
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) expect(decision.retryAfterSeconds).toBeGreaterThan(60)
  })
})

describe('phone code limits', () => {
  test('hourly limit triggers at 5', () => {
    expect(exceedsHourlyCodeLimit(4)).toBe(false)
    expect(exceedsHourlyCodeLimit(5)).toBe(true)
  })

  test('max attempts triggers at 5', () => {
    expect(exceedsMaxCodeAttempts(4)).toBe(false)
    expect(exceedsMaxCodeAttempts(5)).toBe(true)
  })

  test('code is expired at the exact expiresAt instant', () => {
    expect(isPhoneCodeExpired(now, now)).toBe(true)
    expect(isPhoneCodeExpired(at(1), now)).toBe(false)
  })
})

describe('decideTokenUse', () => {
  test('used token wins over expiry', () => {
    expect(decideTokenUse({ usedAt: now, expiresAt: at(-1) }, now)).toBe('TOKEN_INVALID')
  })

  test('expired token is rejected at boundary-1 but valid at boundary', () => {
    expect(decideTokenUse({ usedAt: null, expiresAt: at(-1) }, now)).toBe('TOKEN_EXPIRED')
    expect(decideTokenUse({ usedAt: null, expiresAt: now }, now)).toBe('OK')
    expect(decideTokenUse({ usedAt: null, expiresAt: at(1) }, now)).toBe('OK')
  })
})

describe('canUnbindPhone', () => {
  test('requires another login method', () => {
    expect(canUnbindPhone({ email: 'a@example.com', passwordHash: null })).toBe(true)
    expect(canUnbindPhone({ email: null, passwordHash: 'hash' })).toBe(true)
    expect(canUnbindPhone({ email: null, passwordHash: null })).toBe(false)
  })
})
