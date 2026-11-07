import { err, type Logger, ok } from '@yongstack/shared'
import nodemailer from 'nodemailer'

import type { Mailer } from './types'

export interface SmtpMailerOptions {
  host: string
  port: number
  user?: string
  pass?: string
  from: string
}

export function createSmtpMailer(options: SmtpMailerOptions, logger: Logger): Mailer {
  const transporter = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.port === 465,
    auth:
      options.user !== undefined && options.pass !== undefined
        ? { user: options.user, pass: options.pass }
        : undefined,
  })

  return {
    async send(message) {
      try {
        await transporter.sendMail({
          from: options.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          ...(message.html === undefined ? {} : { html: message.html }),
        })
        return ok(undefined)
      } catch (error) {
        logger.error({ err: error, to: message.to }, 'smtp send failed')
        return err('MAIL_SEND_FAILED')
      }
    },
  }
}
