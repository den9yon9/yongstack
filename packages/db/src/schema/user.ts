import {
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { userRole } from "./enums";

export const user = pgTable(
  "user",
  {
    id: serial("id").primaryKey(),
    // 微信开放平台 OpenID，用于微信登录
    wechatOpenId: varchar("wechat_open_id", { length: 256 }),
    // 手机号，可用于登录
    phone: varchar("phone", { length: 20 }).unique(),
    // 用户昵称，允许重复
    nickname: varchar("nickname", { length: 256 }),
    // 用户名，不可重复，可用于登录系统
    username: varchar("username", { length: 50 }),
    // 头像 URL
    avatarUrl: text("avatar_url"),
    // 密码（bcrypt 哈希后存储），允许为空因为用户可能通过第三方登录
    password: text("password"),
    // 用户角色：customer 普通用户 / admin 管理员
    role: userRole("role").notNull().default("customer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("user_wechat_open_id_idx").on(table.wechatOpenId),
    uniqueIndex("user_username_idx").on(table.username),
  ],
);
