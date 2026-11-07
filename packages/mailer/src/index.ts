import type { Logger } from '@yongstack/shared'

import { createConsoleMailer } from './console'
import { createSmtpMailer } from './smtp'
import type { Mailer } from './types'

export type MailTransport = 'console' | 'smtp'

export interface MailerOptions {
  transport: MailTransport
  from: string
  smtp?: {
    host: string
    port: number
    user?: string
    pass?: string
  }
}

export function createMailer(options: MailerOptions, logger: Logger): Mailer {
  if (options.transport === 'console') {
    return createConsoleMailer(logger)
  }

  if (!options.from) throw new Error('[mailer] MAIL_FROM is required for smtp transport')
  if (!options.smtp?.host || !options.smtp.port) {
    throw new Error('[mailer] SMTP_HOST and SMTP_PORT are required for smtp transport')
  }

  return createSmtpMailer({ ...options.smtp, from: options.from }, logger)
}

export type { Mailer, MailError, MailMessage } from './types'
