import type { Result } from '@yongstack/shared'

export interface SmsMessage {
  to: string
  text: string
}

export type SmsError = 'SMS_SEND_FAILED'

export interface SmsProvider {
  send(message: SmsMessage): Promise<Result<void, SmsError>>
}
