import * as schema from "@epinfresh/db/schema";
import { eq } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../lib/db";
import { env } from "../../lib/env";
import type { AuthModel } from "./model";

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
