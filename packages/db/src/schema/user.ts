import {
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable(
  "user",
  {
    id: serial("id").primaryKey(),
    wechatOpenId: varchar("wechat_open_id", { length: 256 }).unique(),
    phone: varchar("phone", { length: 20 }).unique(),
    // 用户昵称，允许重复
    nickname: varchar("nickname", { length: 256 }),
    // 用户名称，不可重复, 可用于登录系统
    username: varchar("username", { length: 50 }).unique(),
    avatarUrl: text("avatar_url"),
    // 允许为空，因为用户可能通过第三方平台登陆, 还没有设置用户名密码
    password: text("password"), // 存储哈希后的密码

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("user_wechat_open_id_idx").on(table.wechatOpenId),
    index("user_phone_idx").on(table.phone),
    uniqueIndex("user_username_idx").on(table.username),
  ],
);
