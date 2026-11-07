import { parseEnv } from '@nestup/shared'
import { type StaticDecode, Type } from '@sinclair/typebox'

const forcePathStyle = Type.Transform(Type.String({ default: 'false' }))
  .Decode((raw: string) => raw.trim() === 'true')
  .Encode((v: boolean) => (v ? 'true' : 'false'))

export const storageEnvSchema = Type.Object({
  STORAGE_ENDPOINT: Type.Optional(Type.String({ format: 'uri' })),
  STORAGE_REGION: Type.String({ default: 'auto' }),
  STORAGE_BUCKET: Type.String(),
  STORAGE_ACCESS_KEY_ID: Type.Optional(Type.String()),
  STORAGE_SECRET_ACCESS_KEY: Type.Optional(Type.String()),
  STORAGE_FORCE_PATH_STYLE: forcePathStyle,
  STORAGE_PUBLIC_BASE_URL: Type.String({ format: 'uri' }),
  STORAGE_KEY_PREFIX: Type.String({ default: 'media' }),
})

export type StorageEnv = StaticDecode<typeof storageEnvSchema>

export function parseStorageEnv(source: Record<string, string | undefined> = process.env) {
  return parseEnv(storageEnvSchema, source)
}
