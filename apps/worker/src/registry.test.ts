import { createLogger } from '@nestup/shared'
import { describe, expect, test } from 'bun:test'

import { createEnv } from './env'
import { registerWorkers } from './registry'

describe('worker registry', () => {
  test('starts with no queues until business domains are added', () => {
    const env = createEnv({
      REDIS_URL: 'redis://localhost:6379',
      DATABASE_URL: 'postgres://localhost:5432/nestup',
      LOG_LEVEL: 'silent',
    })
    const registration = registerWorkers(env, createLogger('silent'))
    expect(registration.workers).toEqual([])
    expect(registration.queues).toEqual([])
  })
})
