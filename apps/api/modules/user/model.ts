import { db } from "@yongstack/db/model";
import Elysia, { t } from "elysia";
import type { InferModelsMap } from "../../lib/InferModel";

export const userModel = new Elysia().model({
  UpdateUserDTO: t.Pick(db.insert.user, ["username", "avatarUrl"]),

  UploadAvatarDTO: t.Object({
    file: t.File({
      maxSize: 5 * 1024 * 1024,
      type: ["image/jpeg", "image/png", "image/webp"],
    }),
  }),
});

export type UserModel = InferModelsMap<typeof userModel>;
