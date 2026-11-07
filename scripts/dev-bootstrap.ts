import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'

const ROOT = resolve(import.meta.dir, '..')
process.chdir(ROOT)

const ENV_PATH = '.env'
const ENV_EXAMPLE_PATH = '.env.example'
const COMPOSE_PATH = 'docker/docker-compose.yml'

interface Options {
  noDocker: boolean
  externalStorage: boolean
  reset: boolean
  checkOnly: boolean
  yes: boolean
  help: boolean
}

interface EnvValues {
  file: Map<string, string>
  created: boolean
  updated: boolean
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    noDocker: false,
    externalStorage: false,
    reset: false,
    checkOnly: false,
    yes: false,
    help: false,
  }
  for (const arg of argv) {
    switch (arg) {
      case '--no-docker':
        opts.noDocker = true
        break
      case '--external-storage':
        opts.externalStorage = true
        break
      case '--reset':
        opts.reset = true
        break
      case '--check-only':
        opts.checkOnly = true
        break
      case '--yes':
      case '-y':
        opts.yes = true
        break
      case '--help':
      case '-h':
        opts.help = true
        break
      default:
        throw new Error(`unknown argument: ${arg}`)
    }
  }
  if (opts.checkOnly && opts.reset) {
    throw new Error('--check-only cannot be combined with --reset')
  }
  if (opts.noDocker && opts.reset) {
    throw new Error('--reset requires Docker; remove --no-docker')
  }
  return opts
}

function printHelp(): void {
  console.log(`Usage: pnpm bootstrap [options]

Local onboarding for yongstack. Creates .env when missing, starts local
infrastructure, initializes the media bucket and runs migrations.

Options:
  --no-docker          Do not start containers; use services already configured in .env
  --external-storage   Use R2/COS/S3 instead of local SeaweedFS (skip storage:init)
  --reset              Remove local Docker volumes first (asks for confirmation)
  --yes, -y            Skip the reset confirmation
  --check-only         Check prerequisites/connectivity without changing anything
  --help, -h           Show this help

Examples:
  pnpm bootstrap
  pnpm bootstrap --no-docker
  pnpm bootstrap --no-docker --external-storage
  pnpm bootstrap --reset
  pnpm bootstrap --check-only`)
}

function fail(message: string): never {
  throw new Error(message)
}

function info(message: string): void {
  console.log(message)
}

function step(index: number, total: number, message: string): void {
  console.log(`\n[${index}/${total}] ${message}`)
}

function parseVersion(raw: string): number[] {
  return raw
    .trim()
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isNaN(part) ? 0 : part))
}

function versionAtLeast(raw: string, major: number, minor = 0): boolean {
  const [currentMajor = 0, currentMinor = 0] = parseVersion(raw)
  return currentMajor > major || (currentMajor === major && currentMinor >= minor)
}

async function capture(cmd: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    cmd,
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (!proc.stdout || !proc.stderr) throw new Error(`failed to capture output: ${cmd.join(' ')}`)
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  return { code: await proc.exited, stdout, stderr }
}

async function run(label: string, cmd: string[]): Promise<void> {
  info(`\n$ ${cmd.join(' ')}`)
  const proc = Bun.spawn({
    cmd,
    cwd: ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  })
  const code = await proc.exited
  if (code !== 0) throw new Error(`${label} failed (exit ${code})`)
}

async function commandVersion(cmd: string[]): Promise<string | null> {
  try {
    const result = await capture(cmd)
    return result.code === 0 ? result.stdout.trim() : null
  } catch {
    return null
  }
}

async function commandAvailable(cmd: string[]): Promise<boolean> {
  try {
    const result = await capture(cmd)
    return result.code === 0
  } catch {
    return false
  }
}

function parseEnvText(text: string): Map<string, string> {
  const values = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line)
    if (!match) continue
    const [, key, rawValue] = match
    if (!key) continue
    const unquoted = rawValue?.trim().replace(/^(['"])(.*)\1$/, '$2') ?? ''
    values.set(key, unquoted)
  }
  return values
}

function setEnvValue(text: string, key: string, value: string): string {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  if (pattern.test(text)) return text.replace(pattern, line)
  return `${text.replace(/\s*$/, '')}\n${line}\n`
}

function isWeakSecret(value: string): boolean {
  return value.length < 32 || value.startsWith('replace-this') || value.startsWith('change-me')
}

function buildEnvText(exampleText: string, existingText: string | null): string {
  const secret = randomBytes(32).toString('base64')
  if (existingText === null) {
    return setEnvValue(exampleText, 'SESSION_SECRET', secret)
  }

  const example = parseEnvText(exampleText)
  const existing = parseEnvText(existingText)
  let next = existingText

  const currentSecret = existing.get('SESSION_SECRET') ?? ''
  if (isWeakSecret(currentSecret)) next = setEnvValue(next, 'SESSION_SECRET', secret)

  const missing: string[] = []
  for (const [key, value] of example) {
    if (key === 'SESSION_SECRET') continue
    if ((existing.get(key) ?? '').length > 0) continue
    missing.push(`${key}=${value}`)
  }
  if (missing.length > 0) {
    next = `${next.replace(/\s*$/, '')}\n\n# --- added by dev-bootstrap ---\n${missing.join('\n')}\n`
  }
  return next
}

function ensureEnvFile(opts: Options): EnvValues {
  const exampleText = readFileSync(ENV_EXAMPLE_PATH, 'utf8')
  const exists = existsSync(ENV_PATH)
  const currentText = exists ? readFileSync(ENV_PATH, 'utf8') : null
  const nextText = buildEnvText(exampleText, currentText)

  if (opts.checkOnly) {
    return {
      file: parseEnvText(currentText ?? exampleText),
      created: !exists,
      updated: false,
    }
  }

  const changed = currentText === null || nextText !== currentText
  if (changed) writeFileSync(ENV_PATH, nextText, 'utf8')
  return {
    file: parseEnvText(nextText),
    created: !exists,
    updated: changed && exists,
  }
}

function envValue(env: EnvValues, key: string): string {
  return process.env[key] ?? env.file.get(key) ?? ''
}

function requiredEnv(env: EnvValues, key: string): string {
  const value = envValue(env, key)
  if (!value) fail(`missing ${key} in .env`)
  return value
}

function hostPort(raw: string, defaultPort: number, label: string): { host: string; port: number } {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    fail(`${label} is not a valid URL: ${raw}`)
  }
  const port = url.port ? Number(url.port) : defaultPort
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`${label} has an invalid port: ${raw}`)
  }
  return { host: url.hostname, port }
}

function isPortOpen(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolvePort) => {
    const socket = connect({ host, port })
    let settled = false
    const finish = (open: boolean) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolvePort(open)
    }
    socket.setTimeout(timeoutMs, () => finish(false))
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
  })
}

async function waitForPort(
  label: string,
  host: string,
  port: number,
  timeoutMs = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isPortOpen(host, port)) return
    await Bun.sleep(1000)
  }
  fail(
    `${label} is not reachable at ${host}:${port} after ${Math.round(timeoutMs / 1000)}s. ` +
      `Try: docker compose -f ${COMPOSE_PATH} logs`,
  )
}

async function checkDocker(): Promise<void> {
  if (!(await commandAvailable(['docker', 'info']))) {
    fail(
      'Docker is not installed or the daemon is not running.\n' +
        '  - Install Docker Desktop / OrbStack / Colima, then rerun pnpm bootstrap\n' +
        '  - Or use services already configured in .env: pnpm bootstrap --no-docker\n' +
        '  - Or use cloud storage: pnpm bootstrap --no-docker --external-storage',
    )
  }
  if (!(await commandAvailable(['docker', 'compose', 'version']))) {
    fail('docker compose v2 is required. Update Docker Desktop or install the compose plugin.')
  }
}

async function confirmReset(opts: Options): Promise<void> {
  if (opts.yes) return
  if (!process.stdin.isTTY) {
    fail('--reset requires --yes when stdin is not interactive')
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(
      'This deletes local Postgres/Redis/SeaweedFS volumes. Type "reset" to continue: ',
    )
    if (answer.trim() !== 'reset') fail('reset aborted')
  } finally {
    rl.close()
  }
}

function validateStorageEnv(env: EnvValues, external: boolean): void {
  const required = [
    'STORAGE_BUCKET',
    'STORAGE_PUBLIC_BASE_URL',
    'STORAGE_ACCESS_KEY_ID',
    'STORAGE_SECRET_ACCESS_KEY',
  ]
  if (!external) required.push('STORAGE_ENDPOINT')
  const missing = required.filter((key) => !envValue(env, key))
  if (missing.length > 0) fail(`missing storage config: ${missing.join(', ')}`)
  if (!envValue(env, 'STORAGE_REGION')) {
    info('[warn] STORAGE_REGION is empty; the storage SDK may need an explicit region')
  }
}

async function checkExistingInfrastructure(env: EnvValues, opts: Options): Promise<void> {
  const db = hostPort(requiredEnv(env, 'DATABASE_URL'), 5432, 'DATABASE_URL')
  const redis = hostPort(requiredEnv(env, 'REDIS_URL'), 6379, 'REDIS_URL')
  for (const [label, target] of [
    ['Postgres', db],
    ['Redis', redis],
  ] as const) {
    if (!(await isPortOpen(target.host, target.port, 3000))) {
      fail(
        `${label} is not reachable at ${target.host}:${target.port}. ` +
          `Start it, or run pnpm bootstrap without --no-docker.`,
      )
    }
    info(`[ok] ${label} ${target.host}:${target.port}`)
  }

  if (!opts.externalStorage) {
    const storage = hostPort(requiredEnv(env, 'STORAGE_ENDPOINT'), 8333, 'STORAGE_ENDPOINT')
    if (!(await isPortOpen(storage.host, storage.port, 3000))) {
      fail(
        `SeaweedFS is not reachable at ${storage.host}:${storage.port}. ` +
          `Start it, or use --external-storage with R2/COS.`,
      )
    }
    info(`[ok] SeaweedFS ${storage.host}:${storage.port}`)
  }
}

async function startDockerInfrastructure(env: EnvValues, opts: Options): Promise<void> {
  if (opts.reset) {
    await confirmReset(opts)
    await run('reset local Docker volumes', ['docker', 'compose', '-f', COMPOSE_PATH, 'down', '-v'])
  }

  const services = opts.externalStorage ? ['postgres', 'redis'] : ['postgres', 'redis', 'seaweedfs']
  try {
    await run('start local infrastructure', [
      'docker',
      'compose',
      '-f',
      COMPOSE_PATH,
      'up',
      '-d',
      ...services,
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `${message}\nIf ports 5432/6379/8333 are already in use, stop the existing services or rerun with --no-docker.`,
      { cause: error },
    )
  }

  const db = hostPort(requiredEnv(env, 'DATABASE_URL'), 5432, 'DATABASE_URL')
  const redis = hostPort(requiredEnv(env, 'REDIS_URL'), 6379, 'REDIS_URL')
  await waitForPort('Postgres', db.host, db.port)
  await waitForPort('Redis', redis.host, redis.port)
  info(`[ok] Postgres ${db.host}:${db.port}`)
  info(`[ok] Redis ${redis.host}:${redis.port}`)

  if (!opts.externalStorage) {
    const storage = hostPort(requiredEnv(env, 'STORAGE_ENDPOINT'), 8333, 'STORAGE_ENDPOINT')
    await waitForPort('SeaweedFS', storage.host, storage.port)
    info(`[ok] SeaweedFS ${storage.host}:${storage.port}`)
  }
}

function printSummary(env: EnvValues, opts: Options): void {
  console.log(`
[ok] Local environment is ready.

  App:         http://localhost:5173
  Admin:       http://localhost:5174
  API docs:    http://localhost:3000/docs
  Admin API:   http://localhost:3001/docs
  Worker:      http://localhost:${envValue(env, 'HEALTH_PORT') || '3100'}/metrics

  Storage:     ${opts.externalStorage ? 'external S3-compatible bucket' : 'local SeaweedFS (http://localhost:8333)'}
  Admin login: ${envValue(env, 'ADMIN_EMAIL') || 'admin@example.com'} / ${envValue(env, 'ADMIN_PASSWORD') || 'admin123456'}

Next:
  pnpm dev

Daily commands:
  pnpm dev
  pnpm check
  pnpm test
  pnpm e2e
`)
}

async function checkOnly(env: EnvValues, opts: Options): Promise<void> {
  let failed = false
  const check = async (label: string, ok: boolean, hint: string) => {
    if (!ok) failed = true
    console.log(`[${ok ? 'ok' : 'missing'}] ${label}${ok ? '' : ` — ${hint}`}`)
  }

  const bunVersion = Bun.version
  const nodeVersion = await commandVersion(['node', '--version'])
  await check(`Bun ${bunVersion}`, versionAtLeast(bunVersion, 1, 2), 'install Bun >= 1.2')
  await check(
    `Node ${nodeVersion ?? 'not found'}`,
    nodeVersion !== null && versionAtLeast(nodeVersion, 22),
    'install Node 22',
  )
  const pnpmVersion = await commandVersion(['pnpm', '--version'])
  await check(
    `pnpm ${pnpmVersion ?? 'not found'}`,
    pnpmVersion !== null && versionAtLeast(pnpmVersion, 10, 7),
    'corepack prepare pnpm@10.7.0 --activate',
  )
  await check('dependencies installed', existsSync('node_modules'), 'run pnpm install')
  await check('.env exists', existsSync(ENV_PATH), 'run pnpm bootstrap')
  await check(
    'SESSION_SECRET',
    !isWeakSecret(envValue(env, 'SESSION_SECRET')),
    'run pnpm bootstrap to generate a strong secret',
  )
  try {
    validateStorageEnv(env, opts.externalStorage)
    console.log('[ok] storage configuration')
  } catch (error) {
    failed = true
    console.log(`[missing] ${error instanceof Error ? error.message : String(error)}`)
  }

  try {
    if (opts.noDocker) {
      await checkExistingInfrastructure(env, opts)
    } else {
      const dockerOk = await commandAvailable(['docker', 'info'])
      const composeOk = dockerOk && (await commandAvailable(['docker', 'compose', 'version']))
      await check('Docker daemon', dockerOk, 'start Docker or use --no-docker')
      await check(
        'docker compose v2',
        composeOk,
        'update Docker Desktop or install the compose plugin',
      )
      if (dockerOk && composeOk) {
        const db = hostPort(requiredEnv(env, 'DATABASE_URL'), 5432, 'DATABASE_URL')
        const redis = hostPort(requiredEnv(env, 'REDIS_URL'), 6379, 'REDIS_URL')
        await check('Postgres reachable', await isPortOpen(db.host, db.port), 'run pnpm bootstrap')
        await check(
          'Redis reachable',
          await isPortOpen(redis.host, redis.port),
          'run pnpm bootstrap',
        )
        if (!opts.externalStorage) {
          const storage = hostPort(requiredEnv(env, 'STORAGE_ENDPOINT'), 8333, 'STORAGE_ENDPOINT')
          await check(
            'SeaweedFS reachable',
            await isPortOpen(storage.host, storage.port),
            'run pnpm bootstrap',
          )
        }
      }
    }
  } catch (error) {
    failed = true
    console.log(`[missing] ${error instanceof Error ? error.message : String(error)}`)
  }

  if (failed) {
    console.log('\nRun pnpm bootstrap to fix what can be automated.')
    process.exit(1)
  }
  console.log('\n[ok] environment looks ready. Start with: pnpm dev')
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    printHelp()
    return
  }

  console.log('yongstack local bootstrap')
  console.log(
    `mode: ${opts.noDocker ? 'existing services' : 'docker'} / ${opts.externalStorage ? 'external storage' : 'local SeaweedFS'}`,
  )

  step(1, 7, 'Check prerequisites')
  if (!versionAtLeast(Bun.version, 1, 2)) fail(`Bun >= 1.2 is required (found ${Bun.version})`)
  const nodeVersion = await commandVersion(['node', '--version'])
  if (nodeVersion === null) fail('Node.js is required (node --version not found)')
  if (!versionAtLeast(nodeVersion, 22)) {
    fail(`Node >= 22 is required (found ${nodeVersion})`)
  }
  const pnpmVersion = await commandVersion(['pnpm', '--version'])
  if (pnpmVersion === null) fail('pnpm is required (pnpm --version not found)')
  if (!versionAtLeast(pnpmVersion, 10, 7)) {
    fail(
      `pnpm >= 10.7 is required (found ${pnpmVersion}); try: corepack prepare pnpm@10.7.0 --activate`,
    )
  }
  if (!opts.noDocker) await checkDocker()
  info(`[ok] Bun ${Bun.version}, Node ${nodeVersion}, pnpm ${pnpmVersion}`)

  const env = ensureEnvFile(opts)
  if (env.created) info('[ok] created .env from .env.example')
  else if (env.updated) info('[ok] updated missing .env values')
  else info('[ok] .env present')

  if (opts.checkOnly) {
    await checkOnly(env, opts)
    return
  }

  step(2, 8, 'Install dependencies')
  await run('install dependencies', ['pnpm', 'install'])

  step(3, 8, 'Validate configuration')
  validateStorageEnv(env, opts.externalStorage)
  info('[ok] storage configuration present')

  step(4, 8, 'Start infrastructure')
  if (opts.noDocker) {
    info('using existing Postgres/Redis' + (opts.externalStorage ? '' : '/SeaweedFS'))
    await checkExistingInfrastructure(env, opts)
  } else {
    await startDockerInfrastructure(env, opts)
  }

  step(5, 8, 'Initialize media storage')
  if (opts.externalStorage) {
    info('[ok] external storage configured; skipping storage:init')
    info('      make sure the bucket exists and public objects are readable')
  } else {
    await run('initialize local object storage', ['pnpm', 'storage:init'])
  }

  step(6, 8, 'Run database migrations')
  await run('run database migrations', ['pnpm', '--filter', '@yongstack/database', 'db:migrate'])

  step(7, 8, 'Seed admin user')
  await run('seed admin user', ['pnpm', '--filter', '@yongstack/database', 'db:seed'])

  step(8, 8, 'Done')
  printSummary(env, opts)
}

await main()
