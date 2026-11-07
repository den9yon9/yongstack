import { createTranslator, DEFAULT_LOCALE, isLocale } from '@yongstack/i18n'
import type { EmailTemplate } from '@yongstack/notifications'
import { assertNever } from '@yongstack/shared'

export interface RenderedEmail {
  subject: string
  text: string
}

export function renderEmail(
  template: EmailTemplate,
  vars: Record<string, string>,
  locale: string,
): RenderedEmail {
  const i18n = createTranslator(isLocale(locale) ? locale : DEFAULT_LOCALE)

  switch (template) {
    case 'welcome':
      return {
        subject: i18n('Welcome to Yongstack'),
        text: i18n('Hi {name}, your account is ready. Sign in at {url}', {
          name: vars.name ?? '',
          url: vars.appUrl ?? '',
        }),
      }
    case 'verify-email':
      return {
        subject: i18n('Verify your email'),
        text: i18n('Hi {name}, verify your email by opening this link: {url}', {
          name: vars.name ?? '',
          url: vars.url ?? '',
        }),
      }
    case 'reset-password':
      return {
        subject: i18n('Reset your password'),
        text: i18n('Open this link to reset your password: {url}', {
          url: vars.url ?? '',
        }),
      }
    default:
      return assertNever(template)
  }
}
