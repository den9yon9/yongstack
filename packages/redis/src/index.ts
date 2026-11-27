import { Redis } from 'ioredis'

export type { Redis }

const BASE_OPTIONS = {
  lazyConnect: true,
  connectTimeout: 2_000,
  retryStrategy: (times: number) => Math.min(times * 200, 1_000),
} as const

// session / 限流: 允许短暂重试, 但用 commandTimeout 兜底, 避免 Redis 卡住时请求无限挂起。
// 不使用 BullMQ 的 maxRetriesPerRequest: null —— 那是阻塞命令的要求, 会放大故障影响。
export function createSessionRedisClient(url: string): Redis {
  return new Redis(url, {
    ...BASE_OPTIONS,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    commandTimeout: 2_000,
  })
}

// BullMQ: 官方要求 maxRetriesPerRequest: null(阻塞命令);
// enableOfflineQueue: false 保证断线期间不缓冲命令, 避免重连后重复处理 job。
export function createQueueRedisClient(url: string): Redis {
  return new Redis(url, {
    ...BASE_OPTIONS,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  })
}
