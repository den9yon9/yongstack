import { type Redis } from '@yongstack/redis'
import { createRedisClient } from '@yongstack/redis'
import { flushTestRedis } from '@yongstack/redis/testing'
import { getTestEnv } from '@yongstack/shared/testing'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { createSessionStore, hasPermission, isAdminSession } from './sessionPlugin'

const env = getTestEnv()

let redis: Redis

beforeAll(async () => {
  redis = createRedisClient(env.TESTING_REDIS_URL)
  await redis.connect()
})

afterAll(async () => {
  await redis.quit()
})

beforeEach(async () => {
  await flushTestRedis()
})

function input(userId: string, roles: string[] = ['member'], permissions: string[] = []) {
  return { userId, roles, permissions, userAgent: 'bun-test', ip: '127.0.0.1' }
}

describe('createSessionStore', () => {
  test('create/destroy maintain the per-user session index', async () => {
    const store = createSessionStore(redis)
    const sessionId = await store.create(input('u-1'))

    const members = await redis.smembers('session:user:u-1')
    expect(members).toEqual([sessionId])

    const session = await store.read(sessionId)
    expect(session).toMatchObject({
      userId: 'u-1',
      roles: ['member'],
      permissions: [],
      userAgent: 'bun-test',
      ip: '127.0.0.1',
    })
    expect(session?.createdAt).toBeTruthy()
    expect(session?.lastSeenAt).toBeTruthy()

    await store.destroy(sessionId)

    expect(await store.read(sessionId)).toBeNull()
    expect(await redis.smembers('session:user:u-1')).toEqual([])
  })

  test('lists sessions for a user', async () => {
    const store = createSessionStore(redis)
    const s1 = await store.create(input('u-1'))
    const s2 = await store.create(input('u-1'))
    await store.create(input('u-2'))

    const sessions = await store.listForUser('u-1')
    expect(sessions.map((session) => session.id).sort()).toEqual([s1, s2].sort())
  })

  test('destroyOtherSessions keeps the current session', async () => {
    const store = createSessionStore(redis)
    const keep = await store.create(input('u-1'))
    const other = await store.create(input('u-1'))

    await store.destroyOtherSessions('u-1', keep)

    expect(await store.read(keep)).not.toBeNull()
    expect(await store.read(other)).toBeNull()
  })

  test("destroyAllForUser removes all of a user's sessions without a full scan", async () => {
    const store = createSessionStore(redis)
    const s1 = await store.create(input('u-1'))
    const s2 = await store.create(input('u-1'))
    const other = await store.create(input('u-2', ['admin'], ['users:read']))

    await store.destroyAllForUser('u-1')

    expect(await store.read(s1)).toBeNull()
    expect(await store.read(s2)).toBeNull()
    expect(await store.read(other)).toMatchObject({ userId: 'u-2', roles: ['admin'] })
    expect(await redis.exists('session:user:u-1')).toBe(0)
  })

  test('destroyAllForUser is a no-op for a user without sessions', async () => {
    const store = createSessionStore(redis)
    await store.destroyAllForUser('ghost')
    expect(await redis.keys('session:user:*')).toEqual([])
  })
})

describe('session helpers', () => {
  test('checks permissions and admin role', () => {
    const session = {
      userId: 'u-1',
      roles: ['admin'],
      permissions: ['users:read'],
      createdAt: '',
      lastSeenAt: '',
      userAgent: null,
      ip: null,
    }
    expect(hasPermission(session, 'users:read')).toBe(true)
    expect(hasPermission(session, 'users:write')).toBe(false)
    expect(isAdminSession(session, 'admin')).toBe(true)
    expect(isAdminSession({ ...session, roles: ['member'] }, 'admin')).toBe(false)
    // 角色码由调用方注入, 未匹配时不放行
    expect(isAdminSession(session, 'superuser')).toBe(false)
  })
})
