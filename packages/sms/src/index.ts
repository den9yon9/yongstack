import type { Logger } from '@yongstack/shared'

import { createConsoleSmsProvider } from './console'
import type { SmsProvider } from './types'

export { smsEnvSchema } from './env'
export type { SmsError, SmsMessage, SmsProvider } from './types'

export interface SmsProviderOptions {
  provider: 'console'
  signName: string
}

export function createSmsProvider(options: SmsProviderOptions, logger: Logger): SmsProvider {
  if (options.provider === 'console') {
    return createConsoleSmsProvider(logger, { signName: options.signName })
  }
  throw new Error(`[sms] unsupported SMS_PROVIDER: ${String(options.provider)}`)
}
