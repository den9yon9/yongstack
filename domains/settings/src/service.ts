import { Value } from '@sinclair/typebox/value'
import { type DbClient, schema, withTransaction } from '@yongstack/database'
import { err, InvariantViolation, ok, type Result } from '@yongstack/shared'
import { eq, inArray, sql } from 'drizzle-orm'

import {
  definitionFor,
  SETTING_DEFINITIONS,
  type SettingDefinition,
  type SettingKey,
  type SettingValue,
} from './definitions'

export type SettingsErrorCode = 'SETTING_UNKNOWN' | 'SETTING_INVALID'

export interface SettingsError {
  code: SettingsErrorCode
  key: string
}

export interface SettingItem {
  key: string
  value: unknown
  description: string
  updatedBy: string | null
  version: number
  updatedAt: Date | null
}

// 批量读取: 一次 WHERE key IN (...) 拿回多个设置, 避免上传路径两次往返。
export async function getSettings<K extends readonly SettingKey[]>(
  keys: K,
  client: DbClient,
): Promise<{ [P in K[number]]: SettingValue<P> }> {
  const values = {} as Record<SettingKey, unknown>
  if (keys.length === 0) return values as { [P in K[number]]: SettingValue<P> }

  const rows = await client
    .select()
    .from(schema.settings)
    .where(inArray(schema.settings.key, [...keys]))
  const rowByKey = new Map(rows.map((row) => [row.key, row]))

  for (const key of keys) {
    const row = rowByKey.get(key)
    const definition = SETTING_DEFINITIONS[key]
    if (!row) {
      values[key] = definition.defaultValue
      continue
    }
    if (!Value.Check(definition.schema, row.value)) {
      throw new InvariantViolation(`invalid stored setting: ${key}`)
    }
    values[key] = row.value
  }
  return values as { [P in K[number]]: SettingValue<P> }
}

export async function getSetting<K extends SettingKey>(
  key: K,
  client: DbClient,
): Promise<SettingValue<K>> {
  const values = await getSettings([key], client)
  return values[key]
}

export async function listSettings(client: DbClient): Promise<SettingItem[]> {
  const rows = await client.select().from(schema.settings)
  const byKey = new Map(rows.map((row) => [row.key, row]))
  const keys = new Set<string>([...Object.keys(SETTING_DEFINITIONS), ...rows.map((row) => row.key)])
  const items: SettingItem[] = []

  for (const key of [...keys].sort()) {
    const row = byKey.get(key)
    const definition = definitionFor(key)

    if (!row) {
      if (!definition) continue
      items.push({
        key,
        value: definition.defaultValue,
        description: definition.description,
        updatedBy: null,
        version: 0,
        updatedAt: null,
      })
      continue
    }

    if (definition && !Value.Check(definition.schema, row.value)) {
      throw new InvariantViolation(`invalid stored setting: ${key}`)
    }

    items.push({
      key,
      value: row.value,
      description: row.description ?? definition?.description ?? '',
      updatedBy: row.updatedBy,
      version: row.version,
      updatedAt: row.updatedAt,
    })
  }

  return items
}

export async function updateSettings(
  values: Record<string, unknown>,
  client: DbClient,
  updatedBy: string,
): Promise<Result<SettingItem[], SettingsError>> {
  const entries: { key: string; value: unknown; definition: SettingDefinition }[] = []

  for (const [key, value] of Object.entries(values)) {
    const definition = definitionFor(key)
    if (!definition) return err({ code: 'SETTING_UNKNOWN', key })
    if (!Value.Check(definition.schema, value)) return err({ code: 'SETTING_INVALID', key })
    entries.push({ key, value, definition })
  }

  if (entries.length === 0) return ok(await listSettings(client))

  return withTransaction(client, async (tx) => {
    for (const entry of entries) {
      await tx
        .insert(schema.settings)
        .values({
          key: entry.key,
          value: entry.value,
          description: entry.definition.description,
          updatedBy,
        })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: {
            value: entry.value,
            description: entry.definition.description,
            updatedBy,
            version: sql`${schema.settings.version} + 1`,
            updatedAt: new Date(),
          },
        })
    }
    return ok(await listSettings(tx))
  })
}

export async function isFeatureEnabled(name: string, client: DbClient): Promise<boolean> {
  const [row] = await client
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, `feature.${name}`))
  return row?.value === true
}

export async function getAppName(client: DbClient): Promise<string> {
  return (await getSetting('app.name', client)) as string
}

export async function isEmailVerificationRequired(client: DbClient): Promise<boolean> {
  return (await getSetting('auth.requireEmailVerification', client)) as boolean
}
