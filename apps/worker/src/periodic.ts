import type { Logger } from '@yongstack/shared'

export interface PeriodicTaskHandle {
  close: () => Promise<void>
}

export interface PeriodicTaskOptions {
  name: string
  intervalMs: number
  run: () => Promise<void>
  logger: Logger
}

// 统一的轮询任务封装, 取代散落的 setInterval + running 布尔:
// - 防重叠: 上一轮未结束时跳过本轮(而非排队)。
// - 优雅关闭: clear 定时器后等待在途一轮完成, SIGTERM 不会打断半完成的投递。
// - 抖动: ±15% 随机延迟, 避免多副本在同一毫秒集中轮询。
export function startPeriodicTask(options: PeriodicTaskOptions): PeriodicTaskHandle {
  const { name, intervalMs, run, logger } = options
  let closed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let inflight: Promise<void> = Promise.resolve()

  const tick = () => {
    if (running) return
    running = true
    const started = Date.now()
    inflight = run()
      .then(() => {
        logger.debug({ task: name, durationMs: Date.now() - started }, 'periodic task finished')
      })
      .catch((error) => {
        logger.error({ err: error, task: name }, 'periodic task failed')
      })
      .finally(() => {
        running = false
      })
  }

  const schedule = () => {
    if (closed) return
    const jitter = intervalMs * (0.85 + Math.random() * 0.3)
    timer = setTimeout(() => {
      tick()
      schedule()
    }, jitter)
  }
  schedule()

  return {
    close: async () => {
      closed = true
      if (timer !== undefined) clearTimeout(timer)
      // 等收尾在途一轮(含失败落日志), 保证关闭语义完整
      await inflight
    },
  }
}
