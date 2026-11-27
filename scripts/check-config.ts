// 部署配置不变量检查: dev/e2e 跑 Vite, 永远不会触发 nginx CSP,
// 所以把"生产静态配置是否自洽"做成可进 CI 的断言, 而不是等上线才发现。
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)

function read(path: string): string {
  return readFileSync(new URL(path, root), 'utf8')
}

const failures: string[] = []

function expectContains(source: string, needle: string, message: string): void {
  if (!source.includes(needle)) failures.push(message)
}

// 1. nginx CSP: connect-src 必须放行浏览器直传的目标 origin, 且不残留 dev 地址
const nginx = read('nginx-web.template')
const csp = /Content-Security-Policy "([^"]+)"/.exec(nginx)?.[1]

if (csp === undefined) {
  failures.push('nginx-web.template: 缺少 Content-Security-Policy')
} else {
  expectContains(
    csp,
    "connect-src 'self' ${STORAGE_UPLOAD_ORIGIN}",
    'nginx CSP: connect-src 必须包含 ${STORAGE_UPLOAD_ORIGIN}',
  )
  if (csp.includes('localhost:8333')) {
    failures.push('nginx CSP: 仍残留 dev 地址 localhost:8333')
  }
}

expectContains(nginx, 'Permissions-Policy', 'nginx-web.template: 缺少 Permissions-Policy')

// 2. 两个 web 容器都必须拿到 STORAGE_UPLOAD_ORIGIN, 否则 envsubst 静默留下字面量
const compose = read('docker/docker-compose.prod.yml')
const injections = compose.match(/STORAGE_UPLOAD_ORIGIN:/g)?.length ?? 0
if (injections < 2) {
  failures.push('docker-compose.prod.yml: app-web/admin-web 都必须注入 STORAGE_UPLOAD_ORIGIN')
}

// 3. 生产 env 示例必须给出该变量, 避免部署时才踩空
expectContains(
  read('.env.production.example'),
  'STORAGE_UPLOAD_ORIGIN=',
  '.env.production.example: 缺少 STORAGE_UPLOAD_ORIGIN',
)

if (failures.length > 0) {
  console.error(`[check:config] 失败:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log(
  '[check:config] 通过: nginx CSP connect-src / Permissions-Policy / STORAGE_UPLOAD_ORIGIN 注入',
)
