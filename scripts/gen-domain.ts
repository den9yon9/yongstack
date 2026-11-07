import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const NAME_RE = /^[a-z][a-z0-9-]*$/

function fail(message: string): never {
  console.error(`[gen] ${message}`)
  process.exit(1)
}

function toPascal(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function renderFiles(name: string): Record<string, string> {
  const pascal = toPascal(name)
  return {
    'package.json': `${JSON.stringify(
      {
        name: `@yongstack/${name}`,
        private: true,
        type: 'module',
        main: './src/index.ts',
        types: './src/index.ts',
        exports: { '.': './src/index.ts' },
        scripts: {
          build: 'tsc --noEmit',
          typecheck: 'tsc --noEmit',
          test: 'bun --env-file=../../.env test --parallel=1',
        },
        dependencies: {
          '@yongstack/database': 'workspace:*',
          '@yongstack/shared': 'workspace:*',
          '@sinclair/typebox': '^0.34.0',
          'drizzle-orm': '^0.40.0',
        },
      },
      null,
      2,
    )}\n`,
    'tsconfig.json': `${JSON.stringify(
      {
        extends: '../../packages/tsconfig/base.json',
        compilerOptions: { outDir: './dist' },
        include: ['src'],
      },
      null,
      2,
    )}\n`,
    'src/model.ts': `import { Type } from '@sinclair/typebox'

// TODO: 从 packages/database 的 table.select 派生真实模型
export const ${pascal}ResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
})
`,
    'src/service.ts': `import { ok, type Result } from '@yongstack/shared'

// TODO: 替换为真实业务实现
export async function ping${pascal}(): Promise<Result<{ ok: true }, never>> {
  return ok({ ok: true })
}
`,
    'src/index.ts': `export { ${pascal}ResponseSchema } from './model'
export { ping${pascal} } from './service'
`,
    'src/service.test.ts': `import { describe, expect, test } from 'bun:test'

import { ping${pascal} } from './service'

describe('${name}', () => {
  test('placeholder', async () => {
    const result = await ping${pascal}()
    expect(result.isOk()).toBe(true)
  })
})
`,
  }
}

function main(): void {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const positional = args.filter((arg) => !arg.startsWith('--'))

  if (positional[0] !== 'domain' || positional.length !== 2) {
    fail('usage: pnpm gen domain <name> [--dry-run]')
  }

  const name = positional[1]
  if (!NAME_RE.test(name)) {
    fail('name must match ^[a-z][a-z0-9-]*$ (e.g. billing, user-profile)')
  }

  const target = join(ROOT, 'domains', name)
  if (existsSync(target)) fail(`domains/${name} already exists`)

  const files = renderFiles(name)
  if (dryRun) {
    for (const [path, content] of Object.entries(files)) {
      console.log(`\n--- domains/${name}/${path} ---\n${content}`)
    }
    console.log(`\n[dry-run] would create ${Object.keys(files).length} files in domains/${name}`)
    return
  }

  mkdirSync(join(target, 'src'), { recursive: true })
  for (const [path, content] of Object.entries(files)) {
    writeFileSync(join(target, path), content, 'utf8')
  }

  console.log(`[gen] created domains/${name} (${Object.keys(files).length} files)`)
  console.log(`
Next:
  pnpm install
  pnpm --filter @yongstack/${name} typecheck
  1. Add tables under packages/database/src/schema/${name}/
  2. Update packages/database/src/schema/index.ts and model.ts
  3. pnpm --filter @yongstack/database db:generate
  4. Replace placeholder model/service/tests with real logic
`)
}

main()
