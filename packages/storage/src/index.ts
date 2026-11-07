import type { StorageEnv } from './env'
import { createS3Storage } from './s3'
import type { Storage } from './types'

export { parseStorageEnv, type StorageEnv, storageEnvSchema } from './env'
export { createS3Storage } from './s3'
export type { Storage, StorageError } from './types'

export function createStorage(env: StorageEnv): Storage {
  return createS3Storage(env)
}
