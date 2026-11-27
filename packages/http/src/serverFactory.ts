import type { Logger } from '@yongstack/shared'
import { runWithRequestId } from '@yongstack/shared'
import type { AnyElysia } from 'elysia'

export interface StartServerOptions {
  port: number
  logger: Logger
  serviceName: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ponytail: 只认 x-request-id; 网关若用别的名字(x-correlation-id 等), 加进这个数组即可
const REQUEST_ID_HEADERS = ['x-request-id']

function resolveRequestId(request: Request): string {
  for (const name of REQUEST_ID_HEADERS) {
    const incoming = request.headers.get(name)
    if (incoming && UUID_RE.test(incoming)) return incoming
  }
  return crypto.randomUUID()
}

export function startServer<App extends AnyElysia>(app: App, options: StartServerOptions): void {
  const { port, logger, serviceName } = options
  app.compile()
  app.server = Bun.serve({
    port,
    fetch: (request) => runWithRequestId(resolveRequestId(request), () => app.handle(request)),
  })
  logger.info({ port, service: serviceName }, 'API listening')

  const SHUTDOWN_TIMEOUT_MS = 10_000

  async function shutdown() {
    const forceExit = setTimeout(() => {
      logger.error('shutdown timed out, forcing exit')
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)
    forceExit.unref()
    try {
      await app.stop()
    } catch (err) {
      logger.error({ err }, 'shutdown error')
      process.exit(1)
    }
    process.exit(0)
  }

  process.on('SIGTERM', () => {
    void shutdown()
  })
  process.on('SIGINT', () => {
    void shutdown()
  })
}

// liveness: 进程是否还活着; 不依赖下游, 避免 DB/Redis 抖动导致容器被反复重启。
export function livenessCheck(): Response {
  return Response.json({ status: 'ok' })
}

interface PingableRedis {
  ping: () => Promise<unknown>
}

interface HealthCheckDeps {
  db: { execute: (sql: string) => Promise<unknown> }
  // 单实例或[session, queue]; readiness 要求全部可用
  redis: PingableRedis | PingableRedis[]
}

// readiness: 是否可接收流量; 依赖 DB + 所有传入的 Redis 实例。
export async function healthCheck({ db, redis }: HealthCheckDeps): Promise<Response> {
  const clients = Array.isArray(redis) ? redis : [redis]
  let dbOk = false
  let redisOk = false
  try {
    await db.execute('SELECT 1')
    dbOk = true
  } catch {}
  try {
    const results = await Promise.allSettled(clients.map((client) => client.ping()))
    redisOk = results.every((result) => result.status === 'fulfilled')
  } catch {}
  const healthy = dbOk && redisOk
  return Response.json(
    { status: healthy ? 'ok' : 'degraded', db: dbOk, redis: redisOk },
    { status: healthy ? 200 : 503 },
  )
}
