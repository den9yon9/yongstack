import { cors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { Type } from '@sinclair/typebox'
import {
  createMetrics,
  healthCheck,
  httpMetricsPlugin,
  registerHttpMetrics,
  renderMetrics,
  requestLogger,
  securityHeaders,
  startServer,
} from '@yongstack/http'
import { Elysia } from 'elysia'

import { type AppOptions, createAppDeps } from './deps'
import { createEnv } from './env'
import { createPlugins } from './plugins'
import { createUserRoutes } from './routes/user'

const InfoResponse = Type.Object({
  service: Type.String(),
  version: Type.String(),
  runtime: Type.String(),
})

export function buildApp(options: AppOptions) {
  // 监控指标: 进程级 Registry + HTTP 计数, /metrics 端点随 buildApp 挂载
  const metrics = createMetrics()
  const httpMetrics = registerHttpMetrics(metrics)
  const plugins = createPlugins(options, { http: httpMetrics })
  const enableDocs = !options.isProduction
  return new Elysia({
    cookie: {
      secrets: options.sessionSecret,
      sign: [options.sessionCookieName],
    },
  })
    .use(httpMetricsPlugin(httpMetrics))
    .use(requestLogger(options.logger))
    .use(securityHeaders(options.isProduction))
    .use(plugins.redisPlugin)
    .use(plugins.dbPlugin)
    .use(plugins.sessionPlugin)
    .use(plugins.localePlugin)
    .use(cors({ origin: options.corsOrigin, credentials: true, exposeHeaders: ['x-request-id'] }))
    .use(
      enableDocs
        ? openapi({
            path: '/docs',
            documentation: {
              info: { title: 'Yongstack App API', version: '0.1.0' },
            },
          })
        : new Elysia(),
    )
    .use(createUserRoutes(plugins))
    .get(
      '/info',
      () => ({
        service: 'yongstack-app-api',
        version: '0.1.0',
        runtime: `bun ${Bun.version}`,
      }),
      {
        response: { 200: InfoResponse },
        detail: { tags: ['System'], summary: 'Service metadata' },
      },
    )
    .get('/health', ({ db, redis }) => healthCheck({ db, redis }))
    .get(
      '/metrics',
      async () =>
        new Response(await renderMetrics(metrics), {
          headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
        }),
      {
        detail: {
          tags: ['System'],
          summary: 'Prometheus 指标端点(Bun/HTTP 计数, text/plain)',
          description: '供监控平台抓取, 无鉴权(通常由内网/监控白名单访问)。',
        },
      },
    )
}

if (import.meta.main) {
  const env = createEnv()
  const deps = createAppDeps(env)
  startServer(buildApp(deps), {
    serviceName: 'app',
    port: Number(env.APP_PORT),
    logger: deps.logger,
  })
}

export type App = ReturnType<typeof buildApp>
