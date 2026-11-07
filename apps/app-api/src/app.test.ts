import { treaty } from '@elysiajs/eden'
import { closeDb, type Db, schema } from '@yongstack/database'
import { prepareTestDb, resetDb } from '@yongstack/database/testing'
import { assignRoles, ensureRbacDefaults } from '@yongstack/rbac'
import { createRedisClient, type Redis } from '@yongstack/redis'
import { flushTestRedis } from '@yongstack/redis/testing'
import { createLogger } from '@yongstack/shared'
import { getTestEnv } from '@yongstack/shared/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { desc, eq } from 'drizzle-orm'

import { APP_SESSION_COOKIE, type AppOptions } from './deps'
import { type App, buildApp } from './index'

const env = getTestEnv()

let app: App
let api: ReturnType<typeof treaty<typeof app>>
let db: Db
let redis: Redis

beforeAll(async () => {
  db = await prepareTestDb()
  await ensureRbacDefaults(db)
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
  await ensureRbacDefaults(db)
  await flushTestRedis()
})

function createTestDeps(deps: { db: Db; redis: Redis }): AppOptions {
  return {
    ...deps,
    sessionCookieName: APP_SESSION_COOKIE,
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

async function seedUser(email: string, role: 'member' | 'admin' = 'member') {
  const [user] = await db
    .insert(schema.users)
    .values({
      name: email.split('@')[0],
      email,
      passwordHash: await Bun.password.hash('password123', 'argon2id'),
    })
    .returning()
  const assigned = await assignRoles(user.id, [role], db)
  if (assigned.isErr()) throw new Error(assigned.error)
  return user
}

describe('system', () => {
  test('GET /info returns service metadata', async () => {
    const res = await app.handle(new Request('http://localhost/info'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      service: 'yongstack-app-api',
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
    expect(cookie.startsWith(`${APP_SESSION_COOKIE}=`)).toBe(true)

    const me = await api.auth.me.get({ fetch: { headers: { cookie } } })
    expect(me.status).toBe(200)
    if (me.error !== null) throw me.error
    expect(me.data.email).toBe('alice@example.com')
    expect('passwordHash' in me.data).toBe(false)

    const events = await db.select().from(schema.outboxEvents)
    const registered = events.find((event) => event.type === 'user.registered')
    expect(registered).toMatchObject({ status: 'pending' })
    expect(registered?.payload).toMatchObject({ email: 'alice@example.com', name: 'Alice' })
    expect(res.data.roles).toEqual(['member'])
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

    const events = await db.select().from(schema.outboxEvents)
    expect(events).toHaveLength(2)
  })

  test('login sets a signed cookie, tampering is rejected', async () => {
    await seedUser('alice@example.com')
    const login = await api.auth.login.post({
      email: 'alice@example.com',
      password: 'password123',
    })
    expect(login.status).toBe(200)
    const cookie = sessionCookie(login)
    expect(cookie).toMatch(/^yongstack_session=[^;]+\./)

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

async function setRequireEmailVerification(required: boolean) {
  await db
    .insert(schema.settings)
    .values({ key: 'auth.requireEmailVerification', value: required })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value: required },
    })
}

async function latestOutboxPayload(type: string): Promise<Record<string, unknown>> {
  const [event] = await db
    .select()
    .from(schema.outboxEvents)
    .where(eq(schema.outboxEvents.type, type))
    .orderBy(desc(schema.outboxEvents.createdAt))
  if (!event) throw new Error(`missing outbox event: ${type}`)
  return event.payload
}

describe('account lifecycle', () => {
  test('lists and revokes sessions', async () => {
    const first = await api.auth.register.post({
      name: 'Alice',
      email: 'sessions@example.com',
      password: 'password123',
    })
    const firstCookie = sessionCookie(first)
    const second = await api.auth.login.post({
      email: 'sessions@example.com',
      password: 'password123',
    })
    const secondCookie = sessionCookie(second)

    const list = await api.auth.sessions.get({ fetch: { headers: { cookie: firstCookie } } })
    expect(list.status).toBe(200)
    if (list.error !== null) throw list.error
    expect(list.data.items).toHaveLength(2)
    expect(list.data.items.filter((item) => item.current)).toHaveLength(1)

    const other = list.data.items.find((item) => !item.current)
    if (!other) throw new Error('expected second session')
    const revoked = await api.auth
      .sessions({ id: other.id })
      .delete(undefined, { fetch: { headers: { cookie: firstCookie } } })
    expect(revoked.status).toBe(204)

    const withSecond = await api.auth.me.get({ fetch: { headers: { cookie: secondCookie } } })
    expect(withSecond.status).toBe(401)
    const withFirst = await api.auth.me.get({ fetch: { headers: { cookie: firstCookie } } })
    expect(withFirst.status).toBe(200)
  })

  test('revokes other sessions and changes password', async () => {
    const first = await api.auth.register.post({
      name: 'Alice',
      email: 'password@example.com',
      password: 'password123',
    })
    const firstCookie = sessionCookie(first)
    const second = await api.auth.login.post({
      email: 'password@example.com',
      password: 'password123',
    })
    const secondCookie = sessionCookie(second)

    const changed = await api.auth['change-password'].post(
      { currentPassword: 'password123', newPassword: 'new-password-2' },
      { fetch: { headers: { cookie: firstCookie } } },
    )
    expect(changed.status).toBe(204)

    const secondMe = await api.auth.me.get({ fetch: { headers: { cookie: secondCookie } } })
    expect(secondMe.status).toBe(401)
    const firstMe = await api.auth.me.get({ fetch: { headers: { cookie: firstCookie } } })
    expect(firstMe.status).toBe(200)

    const oldLogin = await api.auth.login.post({
      email: 'password@example.com',
      password: 'password123',
    })
    expect(oldLogin.status).toBe(401)
    const newLogin = await api.auth.login.post({
      email: 'password@example.com',
      password: 'new-password-2',
    })
    expect(newLogin.status).toBe(200)
  })

  test('verifies email and gates login when required', async () => {
    await api.auth.register.post({
      name: 'Alice',
      email: 'verify@example.com',
      password: 'password123',
    })
    const payload = await latestOutboxPayload('user.email_verification_requested')
    const token = payload.token as string

    await setRequireEmailVerification(true)
    const blocked = await api.auth.login.post({
      email: 'verify@example.com',
      password: 'password123',
    })
    expect(blocked.status).toBe(403)
    if (blocked.error === null) throw new Error('expected verification error')
    expect(blocked.error.value).toMatchObject({ error: 'EMAIL_NOT_VERIFIED' })

    const verified = await api.auth['verify-email'].post({ token })
    expect(verified.status).toBe(204)
    const replay = await api.auth['verify-email'].post({ token })
    expect(replay.status).toBe(400)

    const login = await api.auth.login.post({
      email: 'verify@example.com',
      password: 'password123',
    })
    expect(login.status).toBe(200)
  })

  test('resends verification for unverified users only', async () => {
    const registered = await api.auth.register.post({
      name: 'Alice',
      email: 'resend@example.com',
      password: 'password123',
    })
    const cookie = sessionCookie(registered)

    const resent = await api.auth['resend-verification'].post({} as never, {
      fetch: { headers: { cookie } },
    })
    expect(resent.status).toBe(202)

    const payload = await latestOutboxPayload('user.email_verification_requested')
    await api.auth['verify-email'].post({ token: payload.token as string })

    const before = await db.select().from(schema.outboxEvents)
    const noop = await api.auth['resend-verification'].post({} as never, {
      fetch: { headers: { cookie } },
    })
    expect(noop.status).toBe(202)
    const after = await db.select().from(schema.outboxEvents)
    expect(after.length).toBe(before.length)
  })

  test('forgot and reset password', async () => {
    await api.auth.register.post({
      name: 'Alice',
      email: 'forgot@example.com',
      password: 'password123',
    })

    const forgot = await api.auth['forgot-password'].post({ email: 'forgot@example.com' })
    expect(forgot.status).toBe(202)
    const payload = await latestOutboxPayload('user.password_reset_requested')

    const reset = await api.auth['reset-password'].post({
      token: payload.token as string,
      password: 'new-password-2',
    })
    expect(reset.status).toBe(204)

    const oldLogin = await api.auth.login.post({
      email: 'forgot@example.com',
      password: 'password123',
    })
    expect(oldLogin.status).toBe(401)
    const newLogin = await api.auth.login.post({
      email: 'forgot@example.com',
      password: 'new-password-2',
    })
    expect(newLogin.status).toBe(200)

    const unknown = await api.auth['forgot-password'].post({ email: 'ghost@example.com' })
    expect(unknown.status).toBe(202)
  })
})
