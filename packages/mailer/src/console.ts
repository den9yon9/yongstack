import { type Logger, ok } from '@yongstack/shared'

import type { Mailer } from './types'

export function createConsoleMailer(logger: Logger): Mailer {
  return {
    async send(message) {
      logger.info(
        { to: message.to, subject: message.subject, text: message.text },
        'mail (console transport)',
      )
      return ok(undefined)
    },
  }
}
