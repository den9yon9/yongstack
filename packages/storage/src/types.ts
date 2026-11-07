import type { Result } from '@nestup/shared'

export type StorageError = 'STORAGE_UNAVAILABLE'

export interface Storage {
  createKey(extension: string): string
  put(key: string, body: Uint8Array, contentType: string): Promise<Result<void, StorageError>>
  publicUrl(key: string): string
  presignGet(key: string, expiresInSeconds?: number): Promise<Result<string, StorageError>>
  delete(key: string): Promise<Result<void, StorageError>>
}
