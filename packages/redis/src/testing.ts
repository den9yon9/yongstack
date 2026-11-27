import { getTestEnv } from '@yongstack/shared/testing'

import { createSessionRedisClient } from './index'

// 测试只用一个 Redis 实例: 隔离是生产部署问题, 测试关心的是 key 清理。
export async function flushTestRedis(url: string = getTestEnv().TESTING_REDIS_URL): Promise<void> {
  const redis = createSessionRedisClient(url)
  try {
    await redis.connect()
    await redis.flushdb()
  } finally {
    await redis.quit()
  }
}
