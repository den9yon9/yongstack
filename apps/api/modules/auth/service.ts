import * as schema from "@epinfresh/db/schema";
import { eq } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../lib/db";
import { env } from "../../lib/env";
import type { AuthModel } from "./model";

// 内存存储验证码 (生产环境建议使用 Redis)
const smsCodeStore = new Map<string, { code: string; expiresAt: number }>();

// 生成6位随机验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送短信验证码
export async function sendSmsCode(phone: string) {
  // 检查是否频繁发送 (60秒内)
  const existing = smsCodeStore.get(phone);
  if (existing && Date.now() < existing.expiresAt - 4 * 60 * 1000) {
    throw status(429, "发送过于频繁，请稍后再试");
  }

  const code = generateCode();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟有效期

  // TODO: 接入实际短信服务 (如阿里云、腾讯云等)
  // 目前仅打印到控制台，用于开发测试
  console.log(`[SMS] 发送验证码到 ${phone}: ${code}`);

  smsCodeStore.set(phone, { code, expiresAt });
}

// 验证短信验证码并登录/注册
export async function loginWithPhone(data: AuthModel["PhoneLoginDTO"]) {
  const { phone, code } = data;

  // 验证验证码
  const stored = smsCodeStore.get(phone);
  if (!stored || stored.code !== code || Date.now() > stored.expiresAt) {
    throw status(400, "验证码错误或已过期");
  }

  // 验证成功后删除验证码
  smsCodeStore.delete(phone);

  // 查找或创建用户
  let user = await db.query.user.findFirst({
    where: eq(schema.user.phone, phone),
  });

  if (!user) {
    // 新用户，自动注册
    [user] = await db
      .insert(schema.user)
      .values({
        phone,
        nickname: `用户_${phone.slice(-4)}`,
      })
      .returning();
  }

  return user;
}

export async function wechatLogin(jscode: string) {
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.append("appid", env.WECHAT_MINIPROGRAM_APP_ID);
  url.searchParams.append("secret", env.WECHAT_MINIPROGRAM_SECRET);
  url.searchParams.append("js_code", jscode);
  url.searchParams.append("grant_type", "authorization_code");

  const res = await fetch(url.toString());
  if (!res.ok) throw res;
  // biome-ignore lint/suspicious/noExplicitAny: wechat api response is untyped
  const data: any = await res.json();
  if (data.errcode) throw status(400, data);
  let target = await db.query.user.findFirst({
    where: (user, op) => op.eq(user.wechatOpenId, data.openid),
  });
  if (!target) {
    [target] = await db
      .insert(schema.user)
      .values({
        wechatOpenId: data.openid,
      })
      .returning();
  }
  return target;
}

export async function registerWithPassword(data: AuthModel["SignupDTO"]) {
  // 1. 检查用户名是否已存在
  const existing = await db.query.user.findFirst({
    where: eq(schema.user.username, data.username),
  });

  if (existing) {
    throw status(400, "用户名已存在");
  }

  // 2. 密码加密 (使用 Bun 内置的 bcrypt/argon2 实现)
  const hashedPassword = await Bun.password.hash(data.password);

  // 3. 创建用户
  const [newUser] = await db
    .insert(schema.user)
    .values({
      username: data.username,
      password: hashedPassword,
      nickname: data.nickname || `用户_${data.username}`,
      // wechatOpenId 等字段留空即可
    })
    .returning();

  return newUser;
}

export async function loginWithPassword(data: AuthModel["PasswordLoginDTO"]) {
  // 1. 查找用户
  const user = await db.query.user.findFirst({
    where: eq(schema.user.username, data.username),
  });

  if (!user || !user.password) {
    throw status(401, "用户名或密码错误");
  }

  // 2. 验证密码
  const isMatch = await Bun.password.verify(data.password, user.password);

  if (!isMatch) {
    throw status(401, "用户名或密码错误");
  }

  return user;
}
