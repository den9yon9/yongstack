import { index, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

// 手机号验证码(OTP): 只存 HMAC 哈希, 明文仅在发送时短暂存在于内存。
// 不设 user 外键: 首次验证码登录时用户可能尚未创建(自动注册)。
export const phoneLoginCodes = pgTable(
  'phone_login_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: varchar('phone', { length: 32 }).notNull(),
    codeHash: varchar('code_hash', { length: 128 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    attempts: integer('attempts').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    phoneCreatedIdx: index('phone_login_codes_phone_created_idx').on(t.phone, t.createdAt),
  }),
)
