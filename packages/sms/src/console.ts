import { type Logger, ok } from '@yongstack/shared'

import type { SmsProvider } from './types'

export function createConsoleSmsProvider(
  logger: Logger,
  options: { signName: string },
): SmsProvider {
  return {
    async send(message) {
      logger.info(
        { to: message.to, signName: options.signName, text: message.text },
        'sms (console provider)',
      )
      return ok(undefined)
    },
  }
}
