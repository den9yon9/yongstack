import { type Static, type TSchema, Type } from '@sinclair/typebox'

export const SETTING_DEFINITIONS = {
  'app.name': {
    schema: Type.String({ minLength: 1, maxLength: 100 }),
    defaultValue: 'Yongstack',
    description: 'Application display name',
  },
  'auth.requireEmailVerification': {
    schema: Type.Boolean(),
    defaultValue: false,
    description: 'Require email verification before login',
  },
  'upload.maxBytes': {
    schema: Type.Integer({ minimum: 1, maximum: 100 * 1024 * 1024 }),
    defaultValue: 5 * 1024 * 1024,
    description: 'Maximum upload size in bytes',
  },
  'upload.allowedTypes': {
    schema: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    defaultValue: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    description: 'Allowed upload MIME types',
  },
} as const

export interface SettingDefinition {
  schema: TSchema
  defaultValue: unknown
  description: string
}

export type SettingKey = keyof typeof SETTING_DEFINITIONS
export type SettingValue<K extends SettingKey> = Static<(typeof SETTING_DEFINITIONS)[K]['schema']>

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(SETTING_DEFINITIONS, key)
}

export function definitionFor(key: string): SettingDefinition | null {
  if (isSettingKey(key)) return SETTING_DEFINITIONS[key]
  // feature.* 为动态功能开关, 统一 boolean
  if (key.startsWith('feature.')) {
    return { schema: Type.Boolean(), defaultValue: false, description: 'Feature flag' }
  }
  return null
}
