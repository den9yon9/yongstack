import { treaty } from '@elysiajs/eden'
import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { createRedisClient, type Redis } from '@yongstack/redis'
import { flushTestRedis } from '@yongstack/redis/testing'
import { createLogger } from '@yongstack/shared'
import { getTestEnv } from '@yongstack/shared/testing'
import { createInMemoryStorage } from '@yongstack/storage/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { ADMIN_SESSION_COOKIE, type AdminAppOptions } from './deps'
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

function createTestDeps(deps: { db: Db; redis: Redis }): AdminAppOptions {
  return {
    ...deps,
    storage: createInMemoryStorage(),
    sessionCookieName: ADMIN_SESSION_COOKIE,
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

async function seedUser(email: string, role: 'customer' | 'admin') {
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
      service: 'yongstack-admin-api',
      version: '0.1.0',
    })
  })

  test('GET /health checks db and redis', async () => {
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', db: true, redis: true })
  })
})

describe('admin auth', () => {
  test('admin can login, read /me and logout with an isolated cookie', async () => {
    await seedUser('admin@example.com', 'admin')

    const login = await api.auth.login.post({
      email: 'admin@example.com',
      password: 'password123',
    })
    expect(login.status).toBe(200)
    const cookie = sessionCookie(login)
    expect(cookie.startsWith(`${ADMIN_SESSION_COOKIE}=`)).toBe(true)
    expect(cookie).toMatch(/^yongstack_admin_session=[^;]+\./)

    const me = await api.auth.me.get({ fetch: { headers: { cookie } } })
    expect(me.status).toBe(200)
    if (me.error !== null) throw me.error
    expect(me.data.role).toBe('admin')

    const logout = await api.auth.logout.post({} as never, {
      fetch: { headers: { cookie } },
    })
    expect(logout.status).toBe(204)

    const afterLogout = await api.auth.me.get({ fetch: { headers: { cookie } } })
    expect(afterLogout.status).toBe(401)
  })

  test('customer cannot login to admin', async () => {
    await seedUser('customer@example.com', 'customer')
    const res = await api.auth.login.post({
      email: 'customer@example.com',
      password: 'password123',
    })
    expect(res.status).toBe(403)
  })

  test('unauthenticated /auth/me is rejected', async () => {
    const res = await api.auth.me.get()
    expect(res.status).toBe(401)
  })

  test('disabled admin cannot login or use /me', async () => {
    const admin = await seedUser('disabled@example.com', 'admin')
    const login = await api.auth.login.post({
      email: 'disabled@example.com',
      password: 'password123',
    })
    const cookie = sessionCookie(login)

    await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, admin.id))
    const me = await api.auth.me.get({ fetch: { headers: { cookie } } })
    expect(me.status).toBe(403)

    const secondLogin = await api.auth.login.post({
      email: 'disabled@example.com',
      password: 'password123',
    })
    expect(secondLogin.status).toBe(403)
  })
})

async function loginAdmin(email = 'admin@example.com'): Promise<string> {
  await seedUser(email, 'admin')
  const res = await api.auth.login.post({ email, password: 'password123' })
  return sessionCookie(res)
}

describe('admin settings', () => {
  test('requires admin authentication', async () => {
    const res = await api.admin.settings.get()
    expect(res.status).toBe(401)
  })

  test('lists defaults and updates values', async () => {
    const cookie = await loginAdmin()

    const list = await api.admin.settings.get({ fetch: { headers: { cookie } } })
    expect(list.status).toBe(200)
    if (list.error !== null) throw list.error
    expect(list.data.items.find((item) => item.key === 'app.name')?.value).toBe('Yongstack')

    const updated = await api.admin.settings.put(
      { values: { 'app.name': 'Acme', 'upload.maxBytes': 10485760 } },
      { fetch: { headers: { cookie } } },
    )
    expect(updated.status).toBe(200)
    if (updated.error !== null) throw updated.error
    expect(updated.data.items.find((item) => item.key === 'app.name')?.value).toBe('Acme')
    expect(updated.data.items.find((item) => item.key === 'upload.maxBytes')?.value).toBe(10485760)
  })

  test('rejects invalid values with 400 and unknown keys with 404', async () => {
    const cookie = await loginAdmin()

    const invalid = await api.admin.settings.put(
      { values: { 'upload.maxBytes': -1 } },
      { fetch: { headers: { cookie } } },
    )
    expect(invalid.status).toBe(400)
    if (invalid.error === null) throw new Error('expected invalid setting error')
    expect(invalid.error.value).toMatchObject({ error: 'SETTING_INVALID' })

    const unknown = await api.admin.settings.put(
      { values: { 'unknown.key': true } },
      { fetch: { headers: { cookie } } },
    )
    expect(unknown.status).toBe(404)
    if (unknown.error === null) throw new Error('expected unknown setting error')
    expect(unknown.error.value).toMatchObject({ error: 'SETTING_UNKNOWN' })
  })
})
