import { describe, expect, test } from 'bun:test'

import { createQueueRedisClient, createSessionRedisClient } from './index'

const URL = 'redis://localhost:6379'

describe('redis client factories', () => {
  test('session client allows short retries but bounds command time', () => {
    const client = createSessionRedisClient(URL)
    expect(client.options.maxRetriesPerRequest).toBe(3)
    expect(client.options.enableOfflineQueue).toBe(true)
    expect(client.options.commandTimeout).toBe(2_000)
    client.disconnect()
  })

  test('queue client uses BullMQ-required options', () => {
    const client = createQueueRedisClient(URL)
    expect(client.options.maxRetriesPerRequest).toBeNull()
    expect(client.options.enableOfflineQueue).toBe(false)
    client.disconnect()
  })
})
