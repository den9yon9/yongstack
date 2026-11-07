import { randomUUID } from 'node:crypto'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { err, ok } from '@nestup/shared'

import type { StorageEnv } from './env'
import type { Storage } from './types'

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

function normalizePrefix(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, '')
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/g, '')
}

export function createS3Client(env: StorageEnv): S3Client {
  const hasAccessKey = (env.STORAGE_ACCESS_KEY_ID ?? '').length > 0
  const hasSecretKey = (env.STORAGE_SECRET_ACCESS_KEY ?? '').length > 0
  if (hasAccessKey !== hasSecretKey) {
    throw new Error(
      '[ENV] STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY must be set together',
    )
  }
  if (env.STORAGE_ENDPOINT !== undefined && !hasAccessKey) {
    throw new Error('[ENV] STORAGE_ENDPOINT requires STORAGE_ACCESS_KEY_ID/SECRET_ACCESS_KEY')
  }
  const credentials =
    env.STORAGE_ACCESS_KEY_ID && env.STORAGE_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.STORAGE_ACCESS_KEY_ID,
          secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
        }
      : undefined
  return new S3Client({
    region: env.STORAGE_REGION,
    ...(env.STORAGE_ENDPOINT === undefined ? {} : { endpoint: env.STORAGE_ENDPOINT }),
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    ...(credentials === undefined ? {} : { credentials }),
  })
}

export function createS3Storage(env: StorageEnv): Storage {
  const client = createS3Client(env)
  const prefix = normalizePrefix(env.STORAGE_KEY_PREFIX)
  const publicBaseUrl = normalizeBaseUrl(env.STORAGE_PUBLIC_BASE_URL)

  return {
    createKey(extension) {
      const ext = extension.replace(/^\./, '')
      const name = `${randomUUID()}.${ext}`
      return prefix.length > 0 ? `${prefix}/${name}` : name
    },
    async put(key, body, contentType) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: env.STORAGE_BUCKET,
            Key: key,
            Body: body,
            ContentType: contentType,
            CacheControl: CACHE_CONTROL,
          }),
        )
        return ok(undefined)
      } catch {
        return err('STORAGE_UNAVAILABLE')
      }
    },
    publicUrl(key) {
      return `${publicBaseUrl}/${key.replace(/^\/+/, '')}`
    },
    async presignGet(key, expiresInSeconds = 600) {
      try {
        const url = await getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }),
          { expiresIn: expiresInSeconds },
        )
        return ok(url)
      } catch {
        return err('STORAGE_UNAVAILABLE')
      }
    },
    async delete(key) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }))
        return ok(undefined)
      } catch {
        return err('STORAGE_UNAVAILABLE')
      }
    },
  }
}
