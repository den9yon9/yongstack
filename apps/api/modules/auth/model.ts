import { db } from "@epinfresh/db/model";
import Elysia, { t } from "elysia";

export const AuthModel = {
  WechatLogin: t.Object({
    code: t.String(),
  }),
  RegisterDTO: t.Object({
    username: t.String({ minLength: 3, maxLength: 50 }),
    password: t.String({ minLength: 6 }),
    nickname: t.Optional(t.String()),
  }),
  LoginDTO: t.Object({
    username: t.String(),
    password: t.String(),
  }),
  User: t.Omit(db.select.user, ["password", "phone"]),
};

export const authModel = new Elysia().model(AuthModel);
