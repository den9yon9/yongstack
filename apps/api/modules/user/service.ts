import * as schema from "@epinfresh/db/schema";
import { eq } from "drizzle-orm";
import { status } from "elysia";
import { db } from "../../lib/db";
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
  const [updatedUser] = await db
    .update(schema.user)
    .set(data)
    .where(eq(schema.user.id, userId))
    .returning();

  if (!updatedUser)
    throw status("Not Found", "Update failed or user not found");

  return updatedUser;
}
