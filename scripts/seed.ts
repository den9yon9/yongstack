import { Type } from '@sinclair/typebox'
import { closeDb, createDb, schema } from '@yongstack/database'
import { assignRoles, ensureRbacDefaults } from '@yongstack/rbac'
import { createLogger, hashPassword, parseEnv } from '@yongstack/shared'

const DEFAULT_ADMIN_PASSWORD = 'admin123456'

const env = parseEnv(
  Type.Object({
    DATABASE_URL: Type.String({ format: 'uri' }),
    ADMIN_EMAIL: Type.String({ format: 'email', default: 'admin@example.com' }),
    ADMIN_PASSWORD: Type.String({ minLength: 1, default: DEFAULT_ADMIN_PASSWORD }),
    NODE_ENV: Type.Optional(
      Type.Union([Type.Literal('development'), Type.Literal('production'), Type.Literal('test')]),
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
  }),
)

async function main(): Promise<void> {
  const rbacOnly = process.argv.includes('--rbac-only')
  const logger = createLogger(env.LOG_LEVEL)

  const db = createDb(env.DATABASE_URL)
  try {
    await ensureRbacDefaults(db)
    // 已移除功能的权限码: 清理旧数据库里的残留权限与角色关联(FK cascade)
    await db.$client`DELETE FROM permissions WHERE code IN ('storage:read', 'storage:write', 'storage:delete')`
    if (rbacOnly) {
      logger.info('rbac defaults synced')
      return
    }

    if (
      env.NODE_ENV === 'production' &&
      (env.ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 12)
    ) {
      throw new Error('ADMIN_PASSWORD must be explicitly set (min 12 chars) in production')
    }
    if (env.ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD) {
      logger.warn(
        { adminEmail: env.ADMIN_EMAIL },
        'using default ADMIN_PASSWORD; set a strong password for any non-local environment',
      )
    }

    const passwordHash = await hashPassword(env.ADMIN_PASSWORD)
    const [admin] = await db
      .insert(schema.users)
      .values({
        name: 'Administrator',
        email: env.ADMIN_EMAIL,
        passwordHash,
        emailVerifiedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.users.email,
        set: {
          passwordHash,
          isActive: true,
          emailVerifiedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning()

    const assigned = await assignRoles(admin.id, ['admin'], db)
    if (assigned.isErr()) throw new Error(`failed to assign admin role: ${assigned.error}`)

    logger.info({ admin: { id: admin.id, email: admin.email } }, 'seed complete: admin user ready')
  } finally {
    await closeDb(db)
  }
}

main().catch((err) => {
  console.error(`[seed] ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
