import { randomUUID } from 'node:crypto'

import { err, ok } from '@nestup/shared'

import type { Storage } from './types'

export interface StoredObject {
  body: Uint8Array
  contentType: string
}

export interface InMemoryStorage extends Storage {
  objects: Map<string, StoredObject>
}

export function createInMemoryStorage(
  options: { publicBaseUrl?: string; keyPrefix?: string } = {},
): InMemoryStorage {
  const objects = new Map<string, StoredObject>()
  const publicBaseUrl = (options.publicBaseUrl ?? 'memory://storage').replace(/\/+$/g, '')
  const prefix = (options.keyPrefix ?? 'media').replace(/^\/+|\/+$/g, '')

  return {
    objects,
    createKey(extension) {
      return `${prefix}/${randomUUID()}.${extension.replace(/^\./, '')}`
    },
    async put(key, body, contentType) {
      objects.set(key, { body, contentType })
      return ok(undefined)
    },
    publicUrl(key) {
      return `${publicBaseUrl}/${key.replace(/^\/+/, '')}`
    },
    async presignGet(key) {
      if (!objects.has(key)) return err('STORAGE_UNAVAILABLE')
      return ok(`${publicBaseUrl}/${key.replace(/^\/+/, '')}?signed=true`)
    },
    async delete(key) {
      objects.delete(key)
      return ok(undefined)
    },
  }
}
