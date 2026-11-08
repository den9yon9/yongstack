import { Type } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { DEFAULT_LOCALE, type Locale, resolveLocale, translate } from '@yongstack/i18n'
import type { Redis } from '@yongstack/redis'
import { type Logger } from '@yongstack/shared'
import { type Cookie, Elysia, status } from 'elysia'

// 会话/权限守卫文案也属用户可见: 在守卫处按请求语言取值(不走 controller derive)。
// 只返回 locale, translate 的字面量留在调用点(便于提取器扫描)。
function guardLocale(request: Request, fallback: Locale): Locale {
  return resolveLocale({
    override: request.headers.get('x-locale'),
    acceptLanguage: request.headers.get('accept-language'),
    fallback,
  })
}

const SessionSchema = Type.Object({
  userId: Type.String(),
  roles: Type.Array(Type.String()),
  permissions: Type.Array(Type.String()),
  createdAt: Type.String(),
  lastSeenAt: Type.String(),
  userAgent: Type.Union([Type.String(), Type.Null()]),
  ip: Type.Union([Type.String(), Type.Null()]),
})

export type Session = {
  userId: string
  roles: string[]
  permissions: string[]
  createdAt: string
  lastSeenAt: string
  userAgent: string | null
  ip: string | null
}

export type SessionWithId = Session & { id: string }

export interface SessionInput {
  userId: string
  roles: string[]
  permissions: string[]
  userAgent?: string | null
  ip?: string | null
}

export const SESSION_TTL_SECONDS = 86400
export const DEFAULT_SESSION_COOKIE_NAME = 'session_id'

export function hasPermission(session: Session | null, permission: string): boolean {
  return session?.permissions.includes(permission) ?? false
}

// 管理员角色码由业务层定义并显式传入(apps 从 domains/rbac 取值),
// 本包不持有任何角色字面量,保持领域无关。
export function isAdminSession(session: Session | null, adminRoleCode: string): boolean {
  return session?.roles.includes(adminRoleCode) ?? false
}

function parseSession(raw: string | null): Session | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as unknown
    if (!Value.Check(SessionSchema, value)) return null
    return value as Session
  } catch {
    return null
  }
}

function resolveSecret(secret: string): string {
  if (!secret || secret.length < 32) {
    throw new Error('[session] SESSION_SECRET is required (min 32 chars). Pass it via options.')
  }
  return secret
}

export interface SessionPluginOptions {
  redis: Redis
  sessionSecret: string
  isProduction: boolean
  logger: Logger
  // 会话 cookie 名; 默认 session_id。多应用共享域时按应用隔离(如 yongstack_session / yongstack_admin_session)
  cookieName?: string
  // 无请求语言线索时的回退语言(来自 env DEFAULT_LOCALE)
  defaultLocale?: Locale
  // 管理员角色码(isAdmin 守卫用), 由业务层显式传入(来自 domains/rbac), 本包不设默认
  adminRoleCode: string
}

export function createSessionPlugin(options: SessionPluginOptions) {
  const { redis, isProduction, logger, adminRoleCode } = options
  const defaultLocale = options.defaultLocale ?? DEFAULT_LOCALE
  const cookieName = options.cookieName ?? DEFAULT_SESSION_COOKIE_NAME
  // 签名配置在根 app 的 Elysia 构造选项上（cookieName 由 Elysia 负责签名/验签）；插件侧只做启动校验
  resolveSecret(options.sessionSecret)
  return new Elysia({ name: 'session' })
    .decorate('sessionStore', createSessionStore(redis))
    .derive({ as: 'scoped' }, async ({ cookie }) => {
      const sessionCookie = cookie[cookieName]
      const sessionId = sessionCookie?.value
      if (typeof sessionId !== 'string' || sessionId.length === 0) {
        return { session: null } satisfies { session: Session | null }
      }
      try {
        const raw = await redis.get(`session:${sessionId}`)
        const session = parseSession(raw)
        if (session) {
          const ttl = await redis.ttl(`session:${sessionId}`)
          if (ttl > 0 && ttl < SESSION_TTL_SECONDS / 2) {
            const refreshed: Session = { ...session, lastSeenAt: new Date().toISOString() }
            await redis.set(
              `session:${sessionId}`,
              JSON.stringify(refreshed),
              'EX',
              SESSION_TTL_SECONDS,
            )
            setSessionCookie(sessionCookie, sessionId, isProduction)
            return { session: refreshed } satisfies { session: Session | null }
          }
        }
        return { session } satisfies { session: Session | null }
      } catch (err) {
        logger.error({ err }, 'session redis lookup failed')
        return { session: null } satisfies { session: Session | null }
      }
    })
    .macro({
      isAuth: {
        resolve({ session, request }) {
          if (!session)
            return status(401, {
              error: 'UNAUTHORIZED',
              message: translate(guardLocale(request, defaultLocale), 'Unauthorized'),
            })
          return { session }
        },
      },
      isAdmin: {
        resolve({ session, request }) {
          if (!session)
            return status(401, {
              error: 'UNAUTHORIZED',
              message: translate(guardLocale(request, defaultLocale), 'Unauthorized'),
            })
          if (!isAdminSession(session, adminRoleCode))
            return status(403, {
              error: 'FORBIDDEN',
              message: translate(guardLocale(request, defaultLocale), 'Forbidden'),
            })
          return { session }
        },
      },
    })
}

export function setSessionCookie(
  cookie: Cookie<unknown> | undefined,
  sessionId: string,
  secure: boolean,
): void {
  if (!cookie) return
  cookie.set({
    value: sessionId,
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export function clearSessionCookie(cookie: Cookie<unknown> | undefined, secure: boolean): void {
  if (!cookie) return
  cookie.set({
    value: '',
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
}

export interface SessionStore {
  create(input: SessionInput): Promise<string>
  read(sessionId: string): Promise<Session | null>
  listForUser(userId: string): Promise<SessionWithId[]>
  destroy(sessionId: string): Promise<void>
  destroyAllForUser(userId: string): Promise<void>
  destroyOtherSessions(userId: string, keepSessionId: string): Promise<void>
}

// per-user 会话索引: 每次登录 SADD, 使 destroyAllForUser 免全量 scanStream(O(1) SMEMBERS)。
// 索引 key 随会话存活续期(SADD 时 EXPIRE), 会话全部过期后自然消失。
function userSessionsKey(userId: string): string {
  return `session:user:${userId}`
}

export function createSessionStore(redis: Redis): SessionStore {
  return {
    async create(input) {
      const sessionId = crypto.randomUUID()
      const now = new Date().toISOString()
      const session: Session = {
        userId: input.userId,
        roles: input.roles,
        permissions: input.permissions,
        createdAt: now,
        lastSeenAt: now,
        userAgent: input.userAgent ?? null,
        ip: input.ip ?? null,
      }
      await redis.set(`session:${sessionId}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS)
      await redis.sadd(userSessionsKey(input.userId), sessionId)
      await redis.expire(userSessionsKey(input.userId), SESSION_TTL_SECONDS)
      return sessionId
    },
    async read(sessionId) {
      if (!sessionId) return null
      return parseSession(await redis.get(`session:${sessionId}`))
    },
    async listForUser(userId) {
      const ids = await redis.smembers(userSessionsKey(userId))
      if (ids.length === 0) return []
      const values = await redis.mget(ids.map((id) => `session:${id}`))
      const sessions: SessionWithId[] = []
      ids.forEach((id, index) => {
        const session = parseSession(values[index] ?? null)
        if (session) sessions.push({ id, ...session })
      })
      return sessions
    },
    async destroy(sessionId) {
      if (!sessionId) return
      const session = parseSession(await redis.get(`session:${sessionId}`))
      await redis.del(`session:${sessionId}`)
      if (session) await redis.srem(userSessionsKey(session.userId), sessionId)
    },
    async destroyAllForUser(userId) {
      const key = userSessionsKey(userId)
      const members = await redis.smembers(key)
      if (members.length > 0) {
        await redis.del(...members.map((id) => `session:${id}`))
      }
      await redis.del(key)
    },
    async destroyOtherSessions(userId, keepSessionId) {
      const key = userSessionsKey(userId)
      const members = await redis.smembers(key)
      const others = members.filter((id) => id !== keepSessionId)
      if (others.length > 0) {
        await redis.del(...others.map((id) => `session:${id}`))
        await redis.srem(key, ...others)
      }
    },
  }
}
