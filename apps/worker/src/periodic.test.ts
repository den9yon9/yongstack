import { createLogger } from '@yongstack/shared'
import { describe, expect, test } from 'bun:test'

import { startPeriodicTask } from './periodic'

describe('startPeriodicTask', () => {
  test('runs on schedule and skip overlapping runs', async () => {
    let runs = 0
    const task = startPeriodicTask({
      name: 'test',
      intervalMs: 30,
      logger: createLogger('silent'),
      run: () =>
        new Promise<void>((resolve) => {
          runs += 1
          setTimeout(resolve, 50)
        }),
    })

    // 首轮进行中(50ms)覆盖第二次 tick(30ms): 防重叠应只累计 1
    await new Promise((resolve) => setTimeout(resolve, 70))
    expect(runs).toBe(1)
    await task.close()
  })

  test('close waits for the inflight run', async () => {
    let settled = false
    const task = startPeriodicTask({
      name: 'test',
      intervalMs: 20,
      logger: createLogger('silent'),
      run: () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            settled = true
            resolve()
          }, 60)
        }),
    })

    await new Promise((resolve) => setTimeout(resolve, 30))
    await task.close()
    expect(settled).toBe(true)

    // close 之后不再触发新一轮
    const before = settled
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(settled).toBe(before)
  })

  test('run errors are captured, not unhandled', async () => {
    let attempts = 0
    const task = startPeriodicTask({
      name: 'test',
      intervalMs: 20,
      logger: createLogger('silent'),
      run: async () => {
        attempts += 1
        throw new Error('intentional')
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(attempts).toBeGreaterThanOrEqual(2)
    await task.close()
  })
})
