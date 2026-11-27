import { describe, expect, test } from 'bun:test'

import { createEnv } from './env'

const BASE_ENV = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/yongstack',
  REDIS_SESSION_URL: 'redis://localhost:6379',
  SESSION_SECRET: 'x'.repeat(32),
  APP_PORT: '3000',
  STORAGE_BUCKET: 'yongstack',
  STORAGE_PUBLIC_BASE_URL: 'https://media.example.com',
}

describe('createEnv CORS_ORIGIN', () => {
  test('defaults to the app web dev origin', () => {
    expect(createEnv(BASE_ENV).CORS_ORIGIN).toBe('http://localhost:5173')
  })

  test('accepts a single explicit origin', () => {
    expect(createEnv({ ...BASE_ENV, CORS_ORIGIN: 'https://app.example.com' }).CORS_ORIGIN).toBe(
      'https://app.example.com',
    )
  })

  test('parses a comma separated allowlist', () => {
    expect(
      createEnv({
        ...BASE_ENV,
        CORS_ORIGIN: 'https://app.example.com, https://admin.example.com',
      }).CORS_ORIGIN,
    ).toEqual(['https://app.example.com', 'https://admin.example.com'])
  })

  test('rejects "*" in every environment (credentials are always enabled)', () => {
    expect(() => createEnv({ ...BASE_ENV, CORS_ORIGIN: '*' })).toThrow(/CORS_ORIGIN/)
    expect(() => createEnv({ ...BASE_ENV, NODE_ENV: 'production', CORS_ORIGIN: '*' })).toThrow(
      /CORS_ORIGIN/,
    )
    expect(() => createEnv({ ...BASE_ENV, CORS_ORIGIN: ' , ' })).toThrow(/CORS_ORIGIN/)
  })
})
