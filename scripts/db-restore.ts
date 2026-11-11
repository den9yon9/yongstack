/**
 * PostgreSQL 恢复。
 *
 * 用法:
 *   bun scripts/db-restore.ts <backup-file> [--yes]
 *
 * 目标库通过 RESTORE_DATABASE_URL 指定; 未设置时回退 DATABASE_URL。
 * 恢复会 --clean --if-exists 覆盖目标库, 默认要求交互确认。
 */

import { existsSync } from 'node:fs'

const args = process.argv.slice(2)
const file = args.find((arg) => !arg.startsWith('--'))
const force = args.includes('--yes')

if (!file) {
  console.error('Usage: bun scripts/db-restore.ts <backup-file> [--yes]')
  process.exit(1)
}
if (!existsSync(file)) {
  console.error(`[db:restore] backup file not found: ${file}`)
  process.exit(1)
}

const target = process.env.RESTORE_DATABASE_URL ?? process.env.DATABASE_URL
if (!target) {
  console.error('[db:restore] RESTORE_DATABASE_URL or DATABASE_URL is required')
  process.exit(1)
}

const isProduction = process.env.NODE_ENV === 'production'
if (isProduction && !force) {
  console.error('[db:restore] refusing to restore into NODE_ENV=production without --yes')
  process.exit(1)
}

if (!force) {
  const confirmed = confirm(
    `This will CLEAN and overwrite the target database:\n${target}\nContinue?`,
  )
  if (!confirmed) {
    console.info('[db:restore] cancelled')
    process.exit(1)
  }
}

console.info(`[db:restore] restoring ${file} -> ${target}`)
const result = Bun.spawnSync(
  ['pg_restore', '--clean', '--if-exists', '--no-owner', '--no-acl', '--dbname', target, file],
  { stdout: 'inherit', stderr: 'inherit' },
)
if (result.exitCode !== 0) {
  console.error(`[db:restore] pg_restore exited with ${result.exitCode}`)
  process.exit(1)
}
console.info('[db:restore] done')
