/**
 * PostgreSQL 全量备份。
 *
 * 用法:
 *   bun scripts/db-backup.ts
 *
 * 环境变量:
 *   DATABASE_URL            必填, 目标数据库
 *   BACKUP_DIR              输出目录, 默认 ./backups
 *   BACKUP_RETENTION_DAYS   保留天数, 默认 14
 */

import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('[db:backup] DATABASE_URL is required')
  process.exit(1)
}

const BACKUP_DIR = process.env.BACKUP_DIR ?? './backups'
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS ?? '14')

function timestamp(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('')
}

function run(command: string, args: string[]): void {
  const result = Bun.spawnSync([command, ...args], { stdout: 'inherit', stderr: 'inherit' })
  if (result.exitCode !== 0) {
    throw new Error(`${command} exited with ${result.exitCode}`)
  }
}

async function pruneOldBackups(): Promise<void> {
  if (RETENTION_DAYS <= 0) return
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  const entries = await readdir(BACKUP_DIR).catch(() => [] as string[])
  for (const name of entries) {
    if (!name.startsWith('yongstack-') || !name.endsWith('.dump')) continue
    const path = join(BACKUP_DIR, name)
    const info = await stat(path).catch(() => null)
    if (info && info.mtimeMs < cutoff) {
      await unlink(path)
      console.info(`[db:backup] pruned ${name}`)
    }
  }
}

async function main(): Promise<void> {
  await mkdir(BACKUP_DIR, { recursive: true })
  const file = join(BACKUP_DIR, `yongstack-${timestamp()}.dump`)

  console.info(`[db:backup] dumping to ${file}`)
  run('pg_dump', [
    '--format=custom',
    '--no-owner',
    '--no-acl',
    '--file',
    file,
    DATABASE_URL as string,
  ])

  // 立即验证备份可读, 避免产生“看起来成功但损坏”的文件
  run('pg_restore', ['--list', file])

  const info = await stat(file)
  console.info(`[db:backup] done (${(info.size / 1024 / 1024).toFixed(2)} MiB)`)
  await pruneOldBackups()
}

try {
  await main()
} catch (error) {
  console.error('[db:backup] failed:', error)
  process.exit(1)
}
