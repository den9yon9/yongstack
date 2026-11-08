import { Type } from '@sinclair/typebox'

export const smsEnvSchema = Type.Object({
  // 当前仅实现 console; 后续接入阿里云/Twilio 时扩展此联合类型
  SMS_PROVIDER: Type.Union([Type.Literal('console')], { default: 'console' }),
  SMS_SIGN_NAME: Type.String({ default: 'Yongstack' }),
})
