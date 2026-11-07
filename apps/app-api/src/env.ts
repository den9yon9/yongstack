import { type StaticDecode, Type } from '@sinclair/typebox'
import { parseEnv } from '@yongstack/shared'
import { storageEnvSchema } from '@yongstack/storage'

const corsOrigin = Type.Transform(Type.String({ default: '*' }))
  .Decode((raw: string) => {
    const s = raw.trim()
    if (s === '*') return true
    const list = s
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x.length > 0)
    if (list.length === 0) return true
    if (list.length === 1) return list[0] as string
    return list
  })
  .Encode((v) => (typeof v === 'boolean' ? '*' : Array.isArray(v) ? v.join(',') : v))

const trustProxy = Type.Transform(Type.String({ default: 'false' }))
  .Decode((raw: string) => raw.trim() === 'true')
  .Encode((v) => (v ? 'true' : 'false'))

export const appEnvSchema = Type.Object({
  DATABASE_URL: Type.String({ format: 'uri' }),
  REDIS_URL: Type.String({ format: 'uri' }),
  SESSION_SECRET: Type.String({ minLength: 32 }),
  NODE_ENV: Type.Union(
    [Type.Literal('development'), Type.Literal('production'), Type.Literal('test')],
    {
      default: 'development',
    },
  ),
  LOG_LEVEL: Type.Union(
    [
      Type.Literal('debug'),
      Type.Literal('info'),
      Type.Literal('warn'),
      Type.Literal('error'),
      Type.Literal('silent'),
    ],
    { default: 'info' },
  ),
  CORS_ORIGIN: corsOrigin,
  TRUST_PROXY: trustProxy,
  APP_PORT: Type.String({ pattern: '^\\d+$' }),
  // 无请求语言线索时的回退语言(错误响应 message / 限流文案)
  DEFAULT_LOCALE: Type.Union([Type.Literal('en'), Type.Literal('zh-CN')], { default: 'en' }),
  // 认证接口限流(次/分钟): 注册/登录共用。后续接入 domains/user 时生效
  AUTH_RATE_LIMIT_PER_MINUTE: Type.String({ pattern: '^\\d+$', default: '20' }),
  ...storageEnvSchema.properties,
})

export type AppEnv = StaticDecode<typeof appEnvSchema>

export function createEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  const env = parseEnv(appEnvSchema, source)
  if (env.NODE_ENV === 'production' && env.CORS_ORIGIN === true) {
    throw new Error(
      '[ENV] CORS_ORIGIN cannot be "*" in production; set an explicit origin or comma-separated allowlist',
    )
  }
  return env
}
