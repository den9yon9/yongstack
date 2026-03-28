import { db } from "@epinfresh/db/model";
import Elysia, { t } from "elysia";
import type { InferModelsMap } from "../../lib/InferModel";

export const authModel = new Elysia().model({
  WechatLoginDTO: t.Object({
    code: t.String(),
  }),
  RegisterDTO: t.Object({
    username: t.String({ minLength: 3, maxLength: 50 }),
    password: t.String({ minLength: 6 }),
    nickname: t.Optional(t.String()),
  }),
  PasswordLoginDTO: t.Object({
    username: t.String(),
    password: t.String(),
  }),
  User: t.Omit(db.select.user, ["password", "phone"]),
});

export type AuthModel = InferModelsMap<typeof authModel>;
