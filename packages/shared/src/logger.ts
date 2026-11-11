import pino, { type Level, type Logger } from 'pino'

export type { Logger } from 'pino'

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const ALLOWED = new Set<LogLevel>(['debug', 'info', 'warn', 'error', 'silent'])

export function createLogger(level: LogLevel): Logger {
  return pino({
    level: ALLOWED.has(level) ? (level as Level) : 'info',
    base: { service: 'yongstack' },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'headers.authorization',
        'headers.cookie',
        // 用户输入中的敏感字段(注册/登录/验证码/令牌)
        'req.body.password',
        'req.body.token',
        'req.body.code',
        'body.password',
        'body.token',
        'body.code',
        'payload.token',
        'payload.code',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.tokenHash',
        '*.code',
        '*.codeHash',
      ],
      censor: '[REDACTED]',
    },
  })
}
