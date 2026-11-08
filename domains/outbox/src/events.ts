// 领域事件类型注册表: outbox payload 的单一来源。
// 生产侧(save)与消费侧(dispatch)都从这里派生类型,
// 新增/修改事件先改这里, 字段漂移在编译期暴露而不是 warn 日志。
// 往表里落库时类型退化为 Record<string, unknown>(jsonb), 消费侧仍需运行时窄化。
export type OutboxEventMap = {
  'user.registered': {
    userId: string
    email: string
    name: string | null
    locale: string
  }
  'user.email_verification_requested': {
    userId: string
    email: string
    name: string | null
    token: string
    locale: string
  }
  'user.password_reset_requested': {
    email: string
    token: string
    locale: string
  }
}

export type OutboxEventName = keyof OutboxEventMap & string
