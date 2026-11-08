import { ok } from '@yongstack/shared'

import type { SmsMessage, SmsProvider } from './types'

export interface MemorySmsProvider extends SmsProvider {
  messages: SmsMessage[]
}

// 测试用: 捕获短信而不真正发送, 便于断言验证码内容。
export function createMemorySmsProvider(): MemorySmsProvider {
  const messages: SmsMessage[] = []
  return {
    messages,
    async send(message) {
      messages.push(message)
      return ok(undefined)
    },
  }
}
