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
}
