// 领域错误基类: 用于需要 instanceof / 栈追踪 / 错误行为的业务失败。
// 只承载领域通用能力, 不包含 HTTP 状态码等表现层概念。
// 注意: 仅用于进程内 Result 流; 跨 outbox/队列/进程边界请使用普通数据。
export abstract class DomainError<C extends string = string> extends Error {
  abstract readonly code: C

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = new.target.name
  }

  toJSON(): { code: C; message: string } {
    return { code: this.code, message: this.message }
  }
}
