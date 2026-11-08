import { randomUUID } from 'node:crypto'

import { type DbClient, schema } from '@yongstack/database'
import { hashPassword } from '@yongstack/shared'
import { eq } from 'drizzle-orm'

export const DEFAULT_PASSWORD = 'password123'

export interface CreateUserOptions {
  email?: string
  name?: string
  password?: string
  phone?: string
  phoneVerified?: boolean
  role?: 'member' | 'admin'
  isActive?: boolean
  emailVerified?: boolean
}

export async function createUser(client: DbClient, options: CreateUserOptions = {}) {
  const email = options.email ?? `user-${randomUUID()}@example.com`
  const password = options.password ?? DEFAULT_PASSWORD
  const passwordHash = await hashPassword(password)

  const [user] = await client
    .insert(schema.users)
    .values({
      name: options.name ?? email.split('@')[0],
      email,
      passwordHash,
      phone: options.phone ?? null,
      phoneVerifiedAt: options.phone && options.phoneVerified !== false ? new Date() : null,
      isActive: options.isActive ?? true,
      emailVerifiedAt: options.emailVerified === false ? null : new Date(),
    })
    .returning()

  const [role] = await client
    .select()
    .from(schema.roles)
    .where(eq(schema.roles.code, options.role ?? 'member'))
  if (role) {
    await client
      .insert(schema.userRoles)
      .values({ userId: user.id, roleId: role.id })
      .onConflictDoNothing()
  }

  return { user, password }
}

export function createAdmin(client: DbClient, options: CreateUserOptions = {}) {
  return createUser(client, { ...options, role: 'admin' })
}

export async function createFile(
  client: DbClient,
  options: { ownerId?: string | null; key?: string; mime?: string; purpose?: string } = {},
) {
  const key = options.key ?? `media/${randomUUID()}.png`
  const [file] = await client
    .insert(schema.files)
    .values({
      ownerId: options.ownerId ?? null,
      key,
      url: `https://cdn.example.com/${key}`,
      mime: options.mime ?? 'image/png',
      size: 1024,
      purpose: options.purpose ?? 'test',
    })
    .returning()
  return file
}

export async function createAuditLog(
  client: DbClient,
  options: {
    actorId?: string | null
    action?: string
    targetType?: string
    targetId?: string | null
    diff?: Record<string, unknown>
  } = {},
) {
  const [log] = await client
    .insert(schema.auditLogs)
    .values({
      actorId: options.actorId ?? null,
      action: options.action ?? 'test.event',
      targetType: options.targetType ?? 'test',
      targetId: options.targetId ?? randomUUID(),
      diff: options.diff ?? {},
    })
    .returning()
  return log
}
