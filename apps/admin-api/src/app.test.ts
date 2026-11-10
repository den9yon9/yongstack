import { treaty } from '@elysiajs/eden'
import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { ensureRbacDefaults } from '@yongstack/rbac'
import { createRedisClient, type Redis } from '@yongstack/redis'
import { flushTestRedis } from '@yongstack/redis/testing'
import { createLogger } from '@yongstack/shared'
import { getTestEnv } from '@yongstack/shared/testing'
import { createMemorySmsProvider, type MemorySmsProvider } from '@yongstack/sms/testing'
import { createInMemoryStorage, type InMemoryStorage } from '@yongstack/storage/testing'
import { createUser } from '@yongstack/testkit'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { ADMIN_SESSION_COOKIE, type AdminAppOptions } from './deps'
import { type App, buildApp } from './index'

const env = getTestEnv()

let app: App
let api: ReturnType<typeof treaty<typeof app>>
let db: Db
let redis: Redis
let storage: InMemoryStorage
let sms: MemorySmsProvider

beforeAll(async () => {
  db = await prepareTestDb()
  await ensureRbacDefaults(db)
  redis = createRedisClient(env.TESTING_REDIS_URL)
  await redis.connect()
  storage = createInMemoryStorage()
  sms = createMemorySmsProvider()
  app = buildApp(createTestDeps({ db, redis }))
  api = treaty<typeof app>(app)
})

afterAll(async () => {
  await Promise.allSettled([closeDb(db), redis.quit()])
})

beforeEach(async () => {
  await resetDb(db)
  await ensureRbacDefaults(db)
  await flushTestRedis()
  storage.objects.clear()
  sms.messages.length = 0
})

function createTestDeps(deps: { db: Db; redis: Redis }): AdminAppOptions {
  return {
    ...deps,
    storage,
    sms,
    sessionCookieName: ADMIN_SESSION_COOKIE,
    sessionSecret: env.TESTING_SESSION_SECRET,
    phoneCodeSecret: env.TESTING_SESSION_SECRET,
    corsOrigin: true,
    trustProxy: false,
    isProduction: false,
    logger: createLogger('silent'),
    authRateLimitPerMinute: 20,
    apiRateLimitPerMinute: 120,
    defaultLocale: 'en',
  }
}

function sessionCookie(res: { headers: unknown }): string {
  return (new Headers(res.headers as Headers).get('set-cookie') ?? '').split(';')[0]
}

async function seedUser(email: string, role: 'member' | 'admin') {
  const { user } = await createUser(db, { email, role, emailVerified: false })
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
    expect(me.data.roles).toContain('admin')

    const logout = await api.auth.logout.post({} as never, {
      fetch: { headers: { cookie } },
    })
    expect(logout.status).toBe(204)

    const afterLogout = await api.auth.me.get({ fetch: { headers: { cookie } } })
    expect(afterLogout.status).toBe(401)
  })

  test('customer cannot login to admin', async () => {
    await seedUser('customer@example.com', 'member')
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

describe('admin user management', () => {
  test('lists users with roles and returns detail', async () => {
    const cookie = await loginAdmin()
    const target = await seedUser('member@example.com', 'member')

    const list = await api.admin.users.get({
      query: { page: 1, pageSize: 10 },
      fetch: { headers: { cookie } },
    })
    expect(list.status).toBe(200)
    if (list.error !== null) throw list.error
    expect(list.data.items.find((user) => user.email === 'member@example.com')?.roles).toEqual([
      'member',
    ])

    const detail = await api.admin.users({ id: target.id }).get({
      fetch: { headers: { cookie } },
    })
    expect(detail.status).toBe(200)
    if (detail.error !== null) throw detail.error
    expect(detail.data.roles).toEqual(['member'])
    expect(detail.data.permissions).toEqual(['files:read'])
  })

  test('updates roles and status, and rejects self modification', async () => {
    const cookie = await loginAdmin()
    const target = await seedUser('target@example.com', 'member')

    const updated = await api.admin
      .users({ id: target.id })
      .patch({ roles: ['admin'], isActive: false }, { fetch: { headers: { cookie } } })
    expect(updated.status).toBe(200)
    if (updated.error !== null) throw updated.error
    expect(updated.data.roles).toEqual(['admin'])
    expect(updated.data.isActive).toBe(false)

    const me = await api.auth.me.get({ fetch: { headers: { cookie } } })
    if (me.error !== null) throw me.error
    const self = await api.admin
      .users({ id: me.data.id })
      .patch({ isActive: false }, { fetch: { headers: { cookie } } })
    expect(self.status).toBe(400)
    if (self.error === null) throw new Error('expected self operation error')
    expect(self.error.value).toMatchObject({ error: 'SELF_OPERATION' })
  })

  test('lists roles and permissions', async () => {
    const cookie = await loginAdmin()

    const roles = await api.admin.roles.get({ fetch: { headers: { cookie } } })
    expect(roles.status).toBe(200)
    if (roles.error !== null) throw roles.error
    expect(roles.data.items.map((role) => role.code)).toEqual(['admin', 'member'])

    const permissions = await api.admin.permissions.get({ fetch: { headers: { cookie } } })
    expect(permissions.status).toBe(200)
    if (permissions.error !== null) throw permissions.error
    expect(permissions.data.items.map((permission) => permission.code)).toContain('users:write')
  })

  test('requires authentication', async () => {
    const res = await api.admin.users.get({ query: { page: 1, pageSize: 10 } })
    expect(res.status).toBe(401)
  })
})

describe('admin files', () => {
  test('lists and deletes files', async () => {
    const cookie = await loginAdmin()
    const key = 'media/admin-file.png'
    storage.objects.set(key, { body: Uint8Array.from([1, 2, 3]), contentType: 'image/png' })
    const [file] = await db
      .insert(schema.files)
      .values({
        key,
        url: `https://cdn.example.com/${key}`,
        mime: 'image/png',
        size: 3,
        purpose: 'avatar',
      })
      .returning()

    const list = await api.admin.files.get({
      query: { page: 1, pageSize: 10 },
      fetch: { headers: { cookie } },
    })
    expect(list.status).toBe(200)
    if (list.error !== null) throw list.error
    expect(list.data.items.map((item) => item.id)).toContain(file.id)

    const deleted = await api.admin
      .files({ id: file.id })
      .delete(undefined, { fetch: { headers: { cookie } } })
    expect(deleted.status).toBe(204)
    expect(storage.objects.has(key)).toBe(false)

    const after = await api.admin.files.get({
      query: { page: 1, pageSize: 10 },
      fetch: { headers: { cookie } },
    })
    if (after.error !== null) throw after.error
    expect(after.data.items).toHaveLength(0)
  })

  test('requires admin authentication', async () => {
    const res = await api.admin.files.get({ query: { page: 1, pageSize: 10 } })
    expect(res.status).toBe(401)
  })
})

describe('admin audit', () => {
  test('records admin actions and lists them', async () => {
    const cookie = await loginAdmin()
    const target = await seedUser('audit-target@example.com', 'member')

    await api.admin
      .users({ id: target.id })
      .patch({ isActive: false }, { fetch: { headers: { cookie } } })

    const res = await api.admin.audit.get({
      query: { page: 1, pageSize: 10 },
      fetch: { headers: { cookie } },
    })
    expect(res.status).toBe(200)
    if (res.error !== null) throw res.error
    const entry = res.data.items.find((item) => item.action === 'admin.user.update')
    expect(entry).toBeDefined()
    expect(entry?.targetId).toBe(target.id)
  })

  test('requires admin authentication', async () => {
    const res = await api.admin.audit.get({ query: { page: 1, pageSize: 10 } })
    expect(res.status).toBe(401)
  })
})

describe('admin outbox', () => {
  test('lists events, aggregates stats and replays failed events', async () => {
    const cookie = await loginAdmin()
    const [failed] = await db
      .insert(schema.outboxEvents)
      .values({
        type: 'user.registered',
        payload: { userId: 'user-1', email: 'a@example.com', name: null, locale: 'en' },
        status: 'failed',
        attempts: 5,
        lastError: 'boom',
      })
      .returning()
    await db.insert(schema.outboxEvents).values({
      type: 'user.password_reset_requested',
      payload: { email: 'a@example.com', token: 'tok', locale: 'en' },
    })

    const list = await api.admin.outbox.get({
      query: { page: 1, pageSize: 10 },
      fetch: { headers: { cookie } },
    })
    expect(list.status).toBe(200)
    if (list.error !== null) throw list.error
    expect(list.data.total).toBe(2)

    const stats = await api.admin.outbox.stats.get({ fetch: { headers: { cookie } } })
    expect(stats.status).toBe(200)
    if (stats.error !== null) throw stats.error
    expect(stats.data).toMatchObject({ pending: 1, failed: 1, total: 2 })

    const replay = await api.admin
      .outbox({ id: failed.id })
      .replay.post({} as never, { fetch: { headers: { cookie } } })
    expect(replay.status).toBe(200)
    if (replay.error !== null) throw replay.error
    expect(replay.data.status).toBe('pending')
    expect(replay.data.attempts).toBe(0)
  })

  test('returns queue job counts', async () => {
    const cookie = await loginAdmin()
    const res = await api.admin.queues.get({ fetch: { headers: { cookie } } })
    expect(res.status).toBe(200)
    if (res.error !== null) throw res.error
    const emailQueue = res.data.items.find((item) => item.name === 'email')
    expect(emailQueue).toBeDefined()
    expect(emailQueue?.counts.failed).toBeGreaterThanOrEqual(0)
  })

  test('requires admin authentication', async () => {
    const list = await api.admin.outbox.get({ query: { page: 1, pageSize: 10 } })
    expect(list.status).toBe(401)
    const queues = await api.admin.queues.get()
    expect(queues.status).toBe(401)
  })
})

function latestSmsCode(): string {
  const message = sms.messages.at(-1)
  if (!message) throw new Error('expected an sms message')
  const match = message.text.match(/\b(\d{6})\b/)
  if (!match) throw new Error(`missing code in sms: ${message.text}`)
  return match[1] as string
}

async function seedPhoneAdmin(phone: string) {
  const { user } = await createUser(db, {
    name: 'Phone Admin',
    email: `phone-admin-${Date.now()}@example.com`,
    phone,
    role: 'admin',
    emailVerified: false,
  })
  return user
}

describe('admin phone auth', () => {
  const phone = '+8613800000002'

  test('admin can log in with phone code', async () => {
    const admin = await seedPhoneAdmin(phone)

    const requested = await api.auth.phone['request-code'].post({ phone })
    expect(requested.status).toBe(202)
    expect(sms.messages).toHaveLength(1)

    const login = await api.auth.phone.login.post({ phone, code: latestSmsCode() })
    expect(login.status).toBe(200)
    if (login.error !== null) throw login.error
    expect(login.data.id).toBe(admin.id)
    expect(login.data.roles).toContain('admin')

    const cookie = sessionCookie(login)
    const me = await api.auth.me.get({ fetch: { headers: { cookie } } })
    expect(me.status).toBe(200)
  })

  test('does not send codes or auto-register for non-admin phones', async () => {
    const requested = await api.auth.phone['request-code'].post({ phone })
    expect(requested.status).toBe(202)
    expect(sms.messages).toHaveLength(0)

    const login = await api.auth.phone.login.post({ phone, code: '123456' })
    expect(login.status).toBe(400)
    const [user] = await db.select().from(schema.users).where(eq(schema.users.phone, phone))
    expect(user).toBeUndefined()
  })
})

describe('admin phone cooldown', () => {
  const phone = '+8613800000006'

  test('returns retryAfterSeconds while resend is cooling down', async () => {
    await seedPhoneAdmin(phone)
    const first = await api.auth.phone['request-code'].post({ phone })
    expect(first.status).toBe(202)

    const second = await api.auth.phone['request-code'].post({ phone })
    expect(second.status).toBe(429)
    if (second.error === null || !('retryAfterSeconds' in second.error.value)) {
      throw new Error('expected rate limit error')
    }
    const body = second.error.value
    expect(body.error).toBe('CODE_REQUESTED_TOO_SOON')
    expect(body.retryAfterSeconds).toBeGreaterThan(0)
    expect(body.retryAfterSeconds).toBeLessThanOrEqual(60)
    expect(new Headers(second.headers as Headers).get('retry-after')).toBe(
      String(body.retryAfterSeconds),
    )
  })
})
