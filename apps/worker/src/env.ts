import { type StaticDecode, Type } from '@sinclair/typebox'
import { parseEnv } from '@yongstack/shared'
import { storageEnvSchema } from '@yongstack/storage'

export const workerEnvSchema = Type.Object({
  NODE_ENV: Type.Union(
    [Type.Literal('development'), Type.Literal('production'), Type.Literal('test')],
    { default: 'development' },
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
  REDIS_URL: Type.String({ format: 'uri' }),
  DATABASE_URL: Type.String({ format: 'uri' }),
  // 可选健康端口: 设置后起一个极简 HTTP /health(容器健康检查与 e2e 就绪探测用)
  HEALTH_PORT: Type.Optional(Type.String({ pattern: '^\\d+$' })),

  // 邮件: console 只打日志(开发默认), smtp 走 nodemailer(生产)
  MAIL_TRANSPORT: Type.Union([Type.Literal('console'), Type.Literal('smtp')], {
    default: 'console',
  }),
  MAIL_FROM: Type.Optional(Type.String()),
  SMTP_HOST: Type.Optional(Type.String()),
  SMTP_PORT: Type.Optional(Type.String({ pattern: '^\\d+$' })),
  SMTP_USER: Type.Optional(Type.String()),
  SMTP_PASS: Type.Optional(Type.String()),
  // 邮件/通知中的前端链接
  APP_WEB_URL: Type.String({ format: 'uri', default: 'http://localhost:5173' }),

  // outbox 轮询
  OUTBOX_POLL_INTERVAL_MS: Type.String({ pattern: '^\\d+$', default: '2000' }),
  OUTBOX_BATCH_SIZE: Type.String({ pattern: '^\\d+$', default: '20' }),

  // 软删文件的对象存储清理: 已删除超过 min age 的记录硬删 DB 行并删除对象
  FILE_CLEANUP_INTERVAL_MS: Type.String({ pattern: '^\\d+$', default: '60000' }),
  FILE_CLEANUP_MIN_AGE_MS: Type.String({ pattern: '^\\d+$', default: '3600000' }),

  // 对象存储(与 app-api 共用同名变量): 未配置时文件清理任务不启动
  ...storageEnvSchema.properties,
  // 放宽 app-api 中必填的两个存储变量, 便于纯邮件 worker 单独部署
  STORAGE_BUCKET: Type.Optional(Type.String()),
  STORAGE_PUBLIC_BASE_URL: Type.Optional(Type.String({ format: 'uri' })),
})

export type WorkerEnv = StaticDecode<typeof workerEnvSchema>

export function createEnv(source: Record<string, string | undefined> = process.env): WorkerEnv {
  return parseEnv(workerEnvSchema, source)
}
