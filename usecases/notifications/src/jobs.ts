export const EMAIL_QUEUE_NAME = 'email'

export const EMAIL_JOB_NAMES = {
  WELCOME: 'welcome',
  VERIFY_EMAIL: 'verify-email',
  RESET_PASSWORD: 'reset-password',
} as const

export type EmailTemplate = 'welcome' | 'verify-email' | 'reset-password'

export interface SendEmailJobData {
  to: string
  template: EmailTemplate
  locale: string
  vars: Record<string, string>
  // 来源请求 ID: worker 消费时恢复请求上下文, 串联 API → outbox → queue → worker
  requestId?: string
}
