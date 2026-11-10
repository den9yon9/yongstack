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
import { desc, eq } from 'drizzle-orm'

import { APP_SESSION_COOKIE, type AppOptions } from './deps'
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

function createTestDeps(deps: { db: Db; redis: Redis }): AppOptions {
  return {
    ...deps,
    storage,
    sms,
    sessionCookieName: APP_SESSION_COOKIE,
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

async function seedUser(email: string, role: 'member' | 'admin' = 'member') {
  const { user } = await createUser(db, { email, role, emailVerified: false })
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

    const updated = await api.auth.me.patch({ name: 'Carol 2' }, { fetch: { headers: { cookie } } })
    expect(updated.status).toBe(200)
    if (updated.error !== null) throw updated.error
    expect(updated.data.name).toBe('Carol 2')
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

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

async function uploadFile(cookie: string, buffer = TINY_PNG, name = 'a.png') {
  const form = new FormData()
  form.set('file', new File([buffer], name, { type: 'image/png' }))
  form.set('purpose', 'avatar')
  return app.handle(
    new Request('http://localhost/files', {
      method: 'POST',
      headers: { cookie },
      body: form,
    }),
  )
}

async function presignFile(cookie: string, body: { filename: string; mime: string; size: number }) {
  return app.handle(
    new Request('http://localhost/files/presign', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

async function confirmFile(
  cookie: string,
  id: string,
  body: { checksum?: string; width?: number; height?: number },
) {
  return app.handle(
    new Request(`http://localhost/files/${id}/confirm`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

describe('files', () => {
  test('uploads, reads and deletes an owned file', async () => {
    const registered = await api.auth.register.post({
      name: 'Alice',
      email: 'upload@example.com',
      password: 'password123',
    })
    const cookie = sessionCookie(registered)

    const uploaded = await uploadFile(cookie)
    expect(uploaded.status).toBe(201)
    const file = (await uploaded.json()) as {
      id: string
      key: string
      width: number
      height: number
    }
    expect(file).toMatchObject({ mime: 'image/png', width: 1, height: 1, purpose: 'avatar' })
    expect(storage.objects.has(file.key)).toBe(true)

    const read = await app.handle(
      new Request(`http://localhost/files/${file.id}`, { headers: { cookie } }),
    )
    expect(read.status).toBe(200)

    const deleted = await app.handle(
      new Request(`http://localhost/files/${file.id}`, { method: 'DELETE', headers: { cookie } }),
    )
    expect(deleted.status).toBe(204)
    expect(storage.objects.has(file.key)).toBe(false)

    const afterDelete = await app.handle(
      new Request(`http://localhost/files/${file.id}`, { headers: { cookie } }),
    )
    expect(afterDelete.status).toBe(404)
  })

  test('rejects spoofed, disallowed and oversized files', async () => {
    const registered = await api.auth.register.post({
      name: 'Alice',
      email: 'upload-guard@example.com',
      password: 'password123',
    })
    const cookie = sessionCookie(registered)

    const spoofed = await uploadFile(cookie, Buffer.from('not an image'))
    expect(spoofed.status).toBe(400)

    await db
      .insert(schema.settings)
      .values({ key: 'upload.allowedTypes', value: ['image/jpeg'] })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: ['image/jpeg'] },
      })
    const disallowed = await uploadFile(cookie)
    expect(disallowed.status).toBe(400)

    await db
      .insert(schema.settings)
      .values({ key: 'upload.maxBytes', value: 10 })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: 10 } })
    const oversized = await uploadFile(cookie)
    expect(oversized.status).toBe(413)
  })

  test('hides files from other users', async () => {
    const owner = await api.auth.register.post({
      name: 'Owner',
      email: 'owner@example.com',
      password: 'password123',
    })
    const other = await api.auth.register.post({
      name: 'Other',
      email: 'other@example.com',
      password: 'password123',
    })
    const uploaded = await uploadFile(sessionCookie(owner))
    const file = (await uploaded.json()) as { id: string }

    const denied = await app.handle(
      new Request(`http://localhost/files/${file.id}`, {
        headers: { cookie: sessionCookie(other) },
      }),
    )
    expect(denied.status).toBe(404)
    const deleteDenied = await app.handle(
      new Request(`http://localhost/files/${file.id}`, {
        method: 'DELETE',
        headers: { cookie: sessionCookie(other) },
      }),
    )
    expect(deleteDenied.status).toBe(404)
  })

  test('presigns, confirms and exposes a direct upload', async () => {
    const registered = await api.auth.register.post({
      name: 'Direct',
      email: 'direct@example.com',
      password: 'password123',
    })
    const cookie = sessionCookie(registered)

    const presigned = await presignFile(cookie, {
      filename: 'avatar.png',
      mime: 'image/png',
      size: 4,
    })
    expect(presigned.status).toBe(201)
    const data = (await presigned.json()) as {
      fileId: string
      key: string
      uploadUrl: string
      headers: Record<string, string>
    }
    expect(data.headers['Content-Type']).toBe('image/png')
    expect(data.uploadUrl).toContain('signed=put')
    // pending 记录在确认前不可读
    expect(storage.objects.has(data.key)).toBe(false)

    await storage.put(data.key, Uint8Array.from([1, 2, 3, 4]), 'image/png')
    const confirmed = await confirmFile(cookie, data.fileId, { checksum: 'abc' })
    expect(confirmed.status).toBe(200)
    const body = (await confirmed.json()) as { size: number; mime: string; checksum: string }
    expect(body).toMatchObject({ size: 4, mime: 'image/png', checksum: 'abc' })

    const read = await app.handle(
      new Request(`http://localhost/files/${data.fileId}`, { headers: { cookie } }),
    )
    expect(read.status).toBe(200)
  })

  test('confirm rejects missing objects and other users', async () => {
    const owner = await api.auth.register.post({
      name: 'Presign Owner',
      email: 'presign-owner@example.com',
      password: 'password123',
    })
    const other = await api.auth.register.post({
      name: 'Presign Other',
      email: 'presign-other@example.com',
      password: 'password123',
    })
    const ownerCookie = sessionCookie(owner)

    const presigned = await presignFile(ownerCookie, {
      filename: 'avatar.png',
      mime: 'image/png',
      size: 4,
    })
    const data = (await presigned.json()) as { fileId: string; key: string }

    const missing = await confirmFile(ownerCookie, data.fileId, {})
    expect(missing.status).toBe(404)

    await storage.put(data.key, Uint8Array.from([1, 2, 3, 4]), 'image/png')
    const denied = await confirmFile(sessionCookie(other), data.fileId, {})
    expect(denied.status).toBe(404)

    const confirmed = await confirmFile(ownerCookie, data.fileId, {})
    expect(confirmed.status).toBe(200)
  })

  test('presign enforces type and size settings', async () => {
    const registered = await api.auth.register.post({
      name: 'Presign Guard',
      email: 'presign-guard@example.com',
      password: 'password123',
    })
    const cookie = sessionCookie(registered)

    await db
      .insert(schema.settings)
      .values({ key: 'upload.maxBytes', value: 10 })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: 10 } })
    const oversized = await presignFile(cookie, {
      filename: 'big.png',
      mime: 'image/png',
      size: 11,
    })
    expect(oversized.status).toBe(413)

    const disallowed = await presignFile(cookie, {
      filename: 'a.exe',
      mime: 'application/x-msdownload',
      size: 4,
    })
    expect(disallowed.status).toBe(400)
  })
})

describe('idempotency', () => {
  test('forgot-password replays the cached response and rejects body drift', async () => {
    await api.auth.register.post({
      name: 'Alice',
      email: 'idempotent@example.com',
      password: 'password123',
    })
    const headers = { 'idempotency-key': 'forgot-key-1' }

    const first = await api.auth['forgot-password'].post(
      { email: 'idempotent@example.com' },
      { fetch: { headers } },
    )
    const second = await api.auth['forgot-password'].post(
      { email: 'idempotent@example.com' },
      { fetch: { headers } },
    )
    expect(first.status).toBe(202)
    expect(second.status).toBe(202)

    const events = await db
      .select()
      .from(schema.outboxEvents)
      .where(eq(schema.outboxEvents.type, 'user.password_reset_requested'))
    expect(events).toHaveLength(1)

    const mismatch = await api.auth['forgot-password'].post(
      { email: 'other@example.com' },
      { fetch: { headers } },
    )
    expect(mismatch.status).toBe(409)
  })
})

function latestSmsCode(): string {
  const message = sms.messages.at(-1)
  if (!message) throw new Error('expected an sms message')
  const match = message.text.match(/\b(\d{6})\b/)
  if (!match) throw new Error(`missing code in sms: ${message.text}`)
  return match[1] as string
}

describe('phone auth', () => {
  const phone = '+8613800000001'

  test('requests a code and auto-registers on first login', async () => {
    const requested = await api.auth.phone['request-code'].post({ phone })
    expect(requested.status).toBe(202)
    expect(sms.messages).toHaveLength(1)
    expect(sms.messages[0]?.to).toBe(phone)

    const login = await api.auth.phone.login.post({ phone, code: latestSmsCode() })
    expect(login.status).toBe(200)
    if (login.error !== null) throw login.error
    expect(login.data.phone).toBe(phone)
    expect(login.data.email).toBeNull()
    expect(login.data.roles).toContain('member')

    const cookie = sessionCookie(login)
    const me = await api.auth.me.get({ fetch: { headers: { cookie } } })
    expect(me.status).toBe(200)
    if (me.error !== null) throw me.error
    expect(me.data.phone).toBe(phone)
    expect(me.data.phoneVerifiedAt).not.toBeNull()

    const [user] = await db.select().from(schema.users).where(eq(schema.users.phone, phone))
    expect(user?.email).toBeNull()
    expect(user?.passwordHash).toBeNull()
    expect(user?.phoneVerifiedAt).not.toBeNull()
  })

  test('rejects wrong codes and locks after five attempts', async () => {
    await api.auth.phone['request-code'].post({ phone })
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await api.auth.phone.login.post({ phone, code: '000000' })
      expect(res.status).toBe(400)
    }
    const locked = await api.auth.phone.login.post({ phone, code: '000000' })
    expect(locked.status).toBe(429)

    const correct = latestSmsCode()
    const replay = await api.auth.phone.login.post({ phone, code: correct })
    expect(replay.status).toBe(400)
  })

  test('binds and unbinds a phone for an existing account', async () => {
    const registered = await api.auth.register.post({
      name: 'Binder',
      email: 'binder@example.com',
      password: 'password123',
    })
    const cookie = sessionCookie(registered)

    const requested = await api.auth.phone.bind['request-code'].post(
      { phone },
      { fetch: { headers: { cookie } } },
    )
    expect(requested.status).toBe(202)

    const bound = await api.auth.phone.bind.post(
      { phone, code: latestSmsCode() },
      { fetch: { headers: { cookie } } },
    )
    expect(bound.status).toBe(204)

    const me = await api.auth.me.get({ fetch: { headers: { cookie } } })
    if (me.error !== null) throw me.error
    expect(me.data.phone).toBe(phone)
    expect(me.data.phoneVerifiedAt).not.toBeNull()

    const other = await api.auth.register.post({
      name: 'Other',
      email: 'other-bind@example.com',
      password: 'password123',
    })
    const otherCookie = sessionCookie(other)
    const conflict = await api.auth.phone.bind['request-code'].post(
      { phone },
      { fetch: { headers: { cookie: otherCookie } } },
    )
    expect(conflict.status).toBe(409)

    const unbound = await api.auth.phone.delete(undefined, {
      fetch: { headers: { cookie } },
    })
    expect(unbound.status).toBe(204)
    const after = await api.auth.me.get({ fetch: { headers: { cookie } } })
    if (after.error !== null) throw after.error
    expect(after.data.phone).toBeNull()
  })
})

describe('phone code cooldown', () => {
  const phone = '+8613800000005'

  test('returns retryAfterSeconds while resend is cooling down', async () => {
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

describe('api rate limit', () => {
  test('limits authenticated file writes', async () => {
    const limited = buildApp({
      ...createTestDeps({ db, redis }),
      apiRateLimitPerMinute: 2,
    })
    const limitedApi = treaty<typeof limited>(limited)

    const registered = await limitedApi.auth.register.post({
      name: 'Limited',
      email: 'limited@example.com',
      password: 'password123',
    })
    expect(registered.status).toBe(201)
    const cookie = sessionCookie(registered)

    const options = { fetch: { headers: { cookie } } }
    const id = '00000000-0000-0000-0000-000000000000'
    const first = await limitedApi.files({ id }).delete(undefined, options)
    expect(first.status).toBe(404)
    const second = await limitedApi.files({ id }).delete(undefined, options)
    expect(second.status).toBe(404)
    const third = await limitedApi.files({ id }).delete(undefined, options)
    expect(third.status).toBe(429)
  })
})
