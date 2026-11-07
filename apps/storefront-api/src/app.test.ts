import { closeDb, createDb, type Db } from '@nestup/database'
import { createRedisClient, type Redis } from '@nestup/redis'
import { flushTestRedis } from '@nestup/redis/testing'
import { createLogger } from '@nestup/shared'
import { getTestEnv } from '@nestup/shared/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import type { StorefrontAppOptions } from './deps'
import { buildApp } from './index'

const env = getTestEnv()

let db: Db
let redis: Redis

beforeAll(async () => {
  db = createDb(env.TESTING_DATABASE_URL)
  redis = createRedisClient(env.TESTING_REDIS_URL)
  await redis.connect()
})

afterAll(async () => {
  await closeDb(db)
  await redis.quit()
})

beforeEach(async () => {
  await flushTestRedis()
})

function createTestApp(options: Partial<StorefrontAppOptions> = {}) {
  return buildApp({
    db,
    redis,
    sessionSecret: env.TESTING_SESSION_SECRET,
    corsOrigin: true,
    trustProxy: false,
    isProduction: false,
    logger: createLogger('silent'),
    authRateLimitPerMinute: 20,
    defaultLocale: 'en',
    ...options,
  })
}

describe('storefront-api', () => {
  test('GET /info returns service metadata', async () => {
    const res = await createTestApp().handle(new Request('http://localhost/info'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      service: 'nestup-storefront-api',
      version: '0.1.0',
    })
  })

  test('GET /health checks db and redis', async () => {
    const res = await createTestApp().handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', db: true, redis: true })
  })
})
