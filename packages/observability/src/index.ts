import * as Sentry from '@sentry/bun'
import type { Logger } from '@yongstack/shared'

export interface ErrorReporterOptions {
  dsn?: string | undefined
  environment?: string | undefined
  release?: string | undefined
  logger: Logger
}

export interface ErrorContext {
  requestId?: string
  path?: string
  [key: string]: unknown
}

export interface ErrorReporter {
  captureException: (error: unknown, context?: ErrorContext) => void
  flush: (timeoutMs?: number) => Promise<boolean>
}

// 未配置 DSN 时返回 no-op: 本地/CI 不产生外部请求, 也不需要降级开关。
function createNoopReporter(): ErrorReporter {
  return {
    captureException: () => {},
    flush: async () => true,
  }
}

export function createErrorReporter(options: ErrorReporterOptions): ErrorReporter {
  if (!options.dsn) return createNoopReporter()

  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    release: options.release,
    // 错误上报优先; 追踪交给 requestId + 日志, 不启用性能采样。
    tracesSampleRate: 0,
  })
  options.logger.info(
    { environment: options.environment, release: options.release },
    'error reporting enabled',
  )

  return {
    captureException(error, context) {
      Sentry.withScope((scope) => {
        if (context !== undefined) {
          const { requestId, path, ...rest } = context
          if (requestId !== undefined) scope.setTag('requestId', requestId)
          if (path !== undefined) scope.setTag('path', path)
          if (Object.keys(rest).length > 0) scope.setContext('extra', rest)
        }
        Sentry.captureException(error)
      })
    },
    flush: async (timeoutMs = 2000) => Sentry.flush(timeoutMs),
  }
}
