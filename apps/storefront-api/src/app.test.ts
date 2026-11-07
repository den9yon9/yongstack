import { treaty } from '@elysiajs/eden'
import { closeDb, type Db, schema } from '@nestup/database'
import { prepareTestDb, resetDb } from '@nestup/database/testing'
import { createRedisClient, type Redis } from '@nestup/redis'
import { flushTestRedis } from '@nestup/redis/testing'
import { createLogger } from '@nestup/shared'
import { getTestEnv } from '@nestup/shared/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { STOREFRONT_SESSION_COOKIE, type StorefrontAppOptions } from './deps'
import { type App, buildApp } from './index'

const env = getTestEnv()

let app: App
let api: ReturnType<typeof treaty<typeof app>>
let db: Db
let redis: Redis

beforeAll(async () => {
  db = await prepareTestDb()
  redis = createRedisClient(env.TESTING_REDIS_URL)
  await redis.connect()
  app = buildApp(createTestDeps({ db, redis }))
  api = treaty<typeof app>(app)
})

afterAll(async () => {
  await Promise.allSettled([closeDb(db), redis.quit()])
})

beforeEach(async () => {
  await resetDb(db)
  await flushTestRedis()
})

function createTestDeps(deps: { db: Db; redis: Redis }): StorefrontAppOptions {
  return {
    ...deps,
    sessionCookieName: STOREFRONT_SESSION_COOKIE,
    sessionSecret: env.TESTING_SESSION_SECRET,
    corsOrigin: true,
    trustProxy: false,
    isProduction: false,
    logger: createLogger('silent'),
    authRateLimitPerMinute: 20,
    defaultLocale: 'en',
  }
}

function sessionCookie(res: { headers: unknown }): string {
  return (new Headers(res.headers as Headers).get('set-cookie') ?? '').split(';')[0]
}

async function seedUser(email: string, role: 'customer' | 'admin' = 'customer') {
  const [user] = await db
    .insert(schema.users)
    .values({
      name: email.split('@')[0],
      email,
      passwordHash: await Bun.password.hash('password123', 'argon2id'),
      role,
    })
    .returning()
  return user
}

describe('system', () => {
  test('GET /info returns service metadata', async () => {
    const res = await app.handle(new Request('http://localhost/info'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      service: 'nestup-storefront-api',
      version: '0.1.0',
    })
  })

  test('GET /health checks db and redis', async () => {
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', db: true, redis: true })
  })
})

describe('auth', () => {
  test('register creates a user, auto-logs in and never returns passwordHash', async () => {
    const res = await api.auth.register.post({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    })
    expect(res.status).toBe(201)
    if (res.error !== null) throw res.error
    expect(res.data.email).toBe('alice@example.com')
    expect('passwordHash' in res.data).toBe(false)

    const cookie = sessionCookie(res)
    expect(cookie.startsWith(`${STOREFRONT_SESSION_COOKIE}=`)).toBe(true)

    const me = await api.auth.me.get({ fetch: { headers: { cookie } } })
    expect(me.status).toBe(200)
    if (me.error !== null) throw me.error
    expect(me.data.email).toBe('alice@example.com')
    expect('passwordHash' in me.data).toBe(false)
  })

  test('register persists the request locale', async () => {
    const res = await api.auth.register.post(
      { name: 'Locale', email: 'locale@example.com', password: 'password123' },
      { fetch: { headers: { 'accept-language': 'zh-CN' } } },
    )
    if (res.error !== null) throw res.error
    expect(res.data.locale).toBe('zh-CN')
  })

  test('register rejects a duplicate email with 409', async () => {
    await api.auth.register.post({
      name: 'Alice',
      email: 'a@example.com',
      password: 'password123',
    })
    const duplicate = await api.auth.register.post({
      name: 'Bob',
      email: 'a@example.com',
      password: 'password123',
    })
    expect(duplicate.status).toBe(409)
    if (duplicate.error === null) throw new Error('expected conflict')
    expect(duplicate.error.value).toMatchObject({ error: 'EMAIL_ALREADY_REGISTERED' })
  })

  test('login sets a signed cookie, tampering is rejected', async () => {
    await seedUser('alice@example.com')
    const login = await api.auth.login.post({
      email: 'alice@example.com',
      password: 'password123',
    })
    expect(login.status).toBe(200)
    const cookie = sessionCookie(login)
    expect(cookie).toMatch(/^nestup_session=[^;]+\./)

    const me = await api.auth.me.get({ fetch: { headers: { cookie } } })
    expect(me.status).toBe(200)

    const tampered = cookie.replace(/\.\S+$/, '.forged')
    const rejected = await api.auth.me.get({ fetch: { headers: { cookie: tampered } } })
    expect(rejected.status).toBe(400)
  })

  test('login returns 401 for bad credentials and 403 for disabled account', async () => {
    const user = await seedUser('bob@example.com')
    const wrong = await api.auth.login.post({
      email: 'bob@example.com',
      password: 'wrong-password',
    })
    expect(wrong.status).toBe(401)

    await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, user.id))
    const disabled = await api.auth.login.post({
      email: 'bob@example.com',
      password: 'password123',
    })
    expect(disabled.status).toBe(403)
  })

  test('logout destroys the session and clears the cookie', async () => {
    const registered = await api.auth.register.post({
      name: 'Alice',
      email: 'logout@example.com',
      password: 'password123',
    })
    const cookie = sessionCookie(registered)

    const logout = await api.auth.logout.post({} as never, {
      fetch: { headers: { cookie } },
    })
    expect(logout.status).toBe(204)

    const me = await api.auth.me.get({ fetch: { headers: { cookie } } })
    expect(me.status).toBe(401)
  })

  test('profile can be updated through /auth/me', async () => {
    const registered = await api.auth.register.post({
      name: 'Carol',
      email: 'carol@example.com',
      password: 'password123',
    })
    const cookie = sessionCookie(registered)

    const updated = await api.auth.me.patch(
      { name: 'Carol 2', phone: '13800000000' },
      { fetch: { headers: { cookie } } },
    )
    expect(updated.status).toBe(200)
    if (updated.error !== null) throw updated.error
    expect(updated.data.name).toBe('Carol 2')
    expect(updated.data.phone).toBe('13800000000')
  })
})
