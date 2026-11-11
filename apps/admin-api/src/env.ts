import { type StaticDecode, Type } from '@sinclair/typebox'
import { parseEnv } from '@yongstack/shared'
import { smsEnvSchema } from '@yongstack/sms'
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

const adminEnvSchema = Type.Object({
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
  ADMIN_PORT: Type.String({ pattern: '^\\d+$' }),
  // 无请求语言线索时的回退语言(错误响应 message / 限流文案)
  DEFAULT_LOCALE: Type.Union([Type.Literal('en'), Type.Literal('zh-CN')], { default: 'en' }),
  // 认证接口限流(次/分钟): 管理员登录。后续接入 domains/user 时生效
  AUTH_RATE_LIMIT_PER_MINUTE: Type.String({ pattern: '^\\d+$', default: '20' }),
  // 通用后台写接口限流(次/分钟): 按管理员/IP 计数
  API_RATE_LIMIT_PER_MINUTE: Type.String({ pattern: '^\\d+$', default: '120' }),
  // 验证码 HMAC 密钥; 未设置时回退 SESSION_SECRET
  PHONE_CODE_SECRET: Type.Optional(Type.String({ minLength: 32 })),
  // 仅开发/测试: 固定验证码, 便于 e2e; 生产禁止
  SMS_DEV_CODE: Type.Optional(Type.String({ pattern: '^\\d{6}$' })),
  // 错误上报(可选): 未配置 DSN 时 no-op, 不影响本地/CI
  SENTRY_DSN: Type.Optional(Type.String({ format: 'uri' })),
  SENTRY_ENVIRONMENT: Type.Optional(Type.String({ maxLength: 100 })),
  SENTRY_RELEASE: Type.Optional(Type.String({ maxLength: 100 })),
  ...smsEnvSchema.properties,
  ...storageEnvSchema.properties,
})

export type AdminEnv = StaticDecode<typeof adminEnvSchema>

export function createEnv(source: Record<string, string | undefined> = process.env): AdminEnv {
  const env = parseEnv(adminEnvSchema, source)
  if (env.NODE_ENV === 'production' && env.CORS_ORIGIN === true) {
    throw new Error(
      '[ENV] CORS_ORIGIN cannot be "*" in production; set an explicit origin or comma-separated allowlist',
    )
  }
  if (env.NODE_ENV === 'production' && env.SMS_DEV_CODE !== undefined) {
    throw new Error('[ENV] SMS_DEV_CODE is forbidden in production')
  }
  return env
}
