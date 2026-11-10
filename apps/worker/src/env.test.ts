import { describe, expect, test } from 'bun:test'

import { createEnv } from './env'

describe('worker env', () => {
  test('defaults mail and outbox config', () => {
    const env = createEnv({
      REDIS_URL: 'redis://localhost:6379',
      DATABASE_URL: 'postgres://localhost:5432/yongstack',
      LOG_LEVEL: 'silent',
    })
    expect(env.MAIL_TRANSPORT).toBe('console')
    expect(env.APP_WEB_URL).toBe('http://localhost:5173')
    expect(env.OUTBOX_POLL_INTERVAL_MS).toBe('2000')
    expect(env.OUTBOX_BATCH_SIZE).toBe('20')
    expect(env.FILE_PENDING_MAX_AGE_MS).toBe('86400000')
  })

  test('parses smtp config', () => {
    const env = createEnv({
      REDIS_URL: 'redis://localhost:6379',
      DATABASE_URL: 'postgres://localhost:5432/yongstack',
      LOG_LEVEL: 'silent',
      MAIL_TRANSPORT: 'smtp',
      MAIL_FROM: 'Yongstack <no-reply@example.com>',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
    })
    expect(env.MAIL_TRANSPORT).toBe('smtp')
    expect(env.SMTP_HOST).toBe('smtp.example.com')
    expect(env.SMTP_PORT).toBe('587')
  })
})
