import { db } from "@epinfresh/db/model";
import Elysia, { t } from "elysia";
import type { InferModelsMap } from "../../lib/InferModel";

export const userModel = new Elysia().model({
  UpdateUserDTO: t.Pick(db.insert.user, ["username", "avatarUrl"]),
});

export type UserModel = InferModelsMap<typeof userModel>;
