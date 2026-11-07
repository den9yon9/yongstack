import type { Result } from '@yongstack/shared'

export interface MailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

export type MailError = 'MAIL_SEND_FAILED'

export interface Mailer {
  send(message: MailMessage): Promise<Result<void, MailError>>
}
