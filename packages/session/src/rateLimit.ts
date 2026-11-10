import { DEFAULT_LOCALE, type Locale, resolveLocale, translate } from '@yongstack/i18n'
import type { Redis } from '@yongstack/redis'
import {
  custom,
  firstOf,
  ip,
  rateLimit as nazliRateLimit,
  type RedisClientLike,
} from 'elysia-nazli'
import { redisStore } from 'elysia-nazli/redis'

export interface AuthRateLimitOptions {
  redis: Redis
  prefix?: string
  namespace?: string
  trustProxy?: boolean
  // 无请求语言线索时的回退语言(来自 env DEFAULT_LOCALE)
  defaultLocale?: Locale
}

export type ApiRateLimitOptions = AuthRateLimitOptions

function limitResponse(request: Request, defaultLocale: Locale): Response {
  // 限流在路由前短路(裸 Response, 不走 onAfterHandle 本地化), 故在此按请求语言取译文。
  const locale = resolveLocale({
    override: request.headers.get('x-locale'),
    acceptLanguage: request.headers.get('accept-language'),
    fallback: defaultLocale,
  })
  return new Response(
    JSON.stringify({ error: 'RATE_LIMITED', message: translate(locale, 'Too many requests') }),
    {
      status: 429,
      headers: { 'content-type': 'application/json;charset=utf-8' },
    },
  )
}

// ponytail: 不配置顶层 limit/window —— nazli 的顶层规则会生成全局 onRequest 计数,
// 一旦 .use() 到路由上会限制整个 API(曾导致商品/购物车接口被 429)。
// 限流只通过路由级 rateLimit 宏生效(login/forgot/reset/register 各自配置, scoped)
export function authRateLimit(opts: AuthRateLimitOptions): ReturnType<typeof nazliRateLimit> {
  const trustProxy = opts.trustProxy ?? false
  const defaultLocale = opts.defaultLocale ?? DEFAULT_LOCALE
  return nazliRateLimit({
    namespace: opts.namespace ?? 'yongstack',
    store: redisStore({
      client: opts.redis as unknown as RedisClientLike,
      adapter: 'ioredis',
      prefix: opts.prefix ?? 'rl',
    }),
    trustProxy,
    headers: { standard: true, legacy: false },
    onLimit: ({ context }) => limitResponse(context.request, defaultLocale),
  })
}

// 通用 API 限流: 登录用户按 userId 计数, 未登录回退 IP。
// 与 authRateLimit 使用不同 pluginName, 可在同一 app 内共存(Elysia 按 name 去重)。
export function apiRateLimit(opts: ApiRateLimitOptions): ReturnType<typeof nazliRateLimit> {
  const trustProxy = opts.trustProxy ?? false
  const defaultLocale = opts.defaultLocale ?? DEFAULT_LOCALE
  return nazliRateLimit({
    pluginName: 'elysia-nazli-api',
    namespace: opts.namespace ?? 'yongstack:api',
    store: redisStore({
      client: opts.redis as unknown as RedisClientLike,
      adapter: 'ioredis',
      prefix: opts.prefix ?? 'rl:api',
    }),
    trustProxy,
    headers: { standard: true, legacy: false },
    key: firstOf(
      custom((ctx) => {
        const session = (ctx as { session?: { userId?: string } | null }).session
        return session?.userId ? `user:${session.userId}` : undefined
      }),
      ip({ trustProxy }),
    ),
    onLimit: ({ context }) => limitResponse(context.request, defaultLocale),
  })
}
