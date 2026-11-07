import { CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3'

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

console.log(`[storage] bucket ${env.STORAGE_BUCKET} is ready for public reads`)
