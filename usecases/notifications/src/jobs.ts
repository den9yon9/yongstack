export const EMAIL_QUEUE_NAME = 'email'

export const EMAIL_JOB_NAMES = {
  WELCOME: 'welcome',
} as const

export type EmailTemplate = 'welcome'

export interface SendEmailJobData {
  to: string
  template: EmailTemplate
  locale: string
  vars: Record<string, string>
}
