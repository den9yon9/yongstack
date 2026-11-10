import type { Result } from '@yongstack/shared'

export type StorageError = 'STORAGE_UNAVAILABLE'

export interface StoredObjectInfo {
  size: number
  contentType: string | null
}

export interface Storage {
  createKey(extension: string): string
  put(key: string, body: Uint8Array, contentType: string): Promise<Result<void, StorageError>>
  publicUrl(key: string): string
  presignGet(key: string, expiresInSeconds?: number): Promise<Result<string, StorageError>>
  presignPut(
    key: string,
    contentType: string,
    expiresInSeconds?: number,
  ): Promise<Result<string, StorageError>>
  head(key: string): Promise<Result<StoredObjectInfo, StorageError>>
  delete(key: string): Promise<Result<void, StorageError>>
}
