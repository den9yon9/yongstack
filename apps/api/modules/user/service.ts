import * as schema from "@epinfresh/db/schema";
import { eq } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../lib/db";
import { decrementFileRef, incrementFileRef } from "../file/service";
import type { UserModel } from "./model";

export async function getMine(userId: number) {
  const user = await db.query.user.findFirst({
    where: eq(schema.user.id, userId),
  });
  if (!user) throw status("Not Found", "User not found");
  return user;
}

export async function updateMine(
  userId: number,
  data: UserModel["UpdateUserDTO"],
) {
  // 1. 获取旧数据以对比
  const oldUser = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
  });

  // 2. 执行更新
  const [updatedUser] = await db
    .update(schema.user)
    .set(data)
    .where(eq(schema.user.id, userId))
    .returning();

  if (!updatedUser) throw status(404, "用户不存在");

  // 3. 引用计数核心逻辑：仅当头像 URL 发生变化时处理
  if (data.avatarUrl !== undefined && data.avatarUrl !== oldUser?.avatarUrl) {
    // 增加新头像计数
    if (data.avatarUrl) {
      await incrementFileRef([data.avatarUrl]);
    }
    // 减少旧头像计数
    if (oldUser?.avatarUrl) {
      await decrementFileRef([oldUser.avatarUrl]);
    }
  }

  return updatedUser;
}
