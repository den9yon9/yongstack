import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3'

import { parseStorageEnv } from '../packages/storage/src/env'
import { createS3Client } from '../packages/storage/src/s3'

const env = parseStorageEnv()
const client = createS3Client(env)

try {
  await client.send(new HeadBucketCommand({ Bucket: env.STORAGE_BUCKET }))
} catch {
  await client.send(new CreateBucketCommand({ Bucket: env.STORAGE_BUCKET }))
  console.log(`[storage] created bucket ${env.STORAGE_BUCKET}`)
}

await client.send(
  new PutBucketPolicyCommand({
    Bucket: env.STORAGE_BUCKET,
    Policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${env.STORAGE_BUCKET}/*`],
        },
      ],
    }),
  }),
)

// 浏览器预签名直传需要 bucket CORS(去掉 preflight 阻塞)
const corsOrigins = (
  process.env.STORAGE_CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0)

if (corsOrigins.length > 0) {
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: env.STORAGE_BUCKET,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: corsOrigins,
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
              AllowedHeaders: ['*'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    )
    console.log(`[storage] CORS enabled for: ${corsOrigins.join(', ')}`)
  } catch (error) {
    console.warn(
      `[storage] failed to set bucket CORS (provider may require console config): ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

console.log(`[storage] bucket ${env.STORAGE_BUCKET} is ready for public reads`)
