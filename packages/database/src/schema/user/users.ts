import { boolean, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }),
    // 手机号验证码自动注册的用户没有邮箱/密码, 故二者可空; 邮箱仍保持唯一
    email: varchar('email', { length: 255 }).unique(),
    passwordHash: varchar('password_hash', { length: 255 }),
    // E.164 格式, 全局唯一; 仅 phoneVerifiedAt 非空时可用于登录
    phone: varchar('phone', { length: 32 }).unique(),
    avatar: text('avatar'),
    // 用户语言偏好(注册/登录时由 Accept-Language 落库); 邮件等异步通知按此渲染
    locale: varchar('locale', { length: 16 }).default('en').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    createdAtIdx: index('users_created_at_idx').on(t.createdAt),
  }),
)
