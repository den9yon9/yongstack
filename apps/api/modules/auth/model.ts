import { db } from "@epinfresh/db/model";
import Elysia, { t } from "elysia";
import type { InferModelsMap } from "../../lib/InferModel";

export const authModel = new Elysia().model({
  WechatLoginDTO: t.Object({
    code: t.String(),
  }),
  SignupDTO: t.Object({
    username: t.String({ minLength: 3, maxLength: 50 }),
    password: t.String({ minLength: 6 }),
    nickname: t.Optional(t.String({ description: "用户昵称" })),
  }),
  PasswordLoginDTO: t.Object({
    username: t.String(),
    password: t.String(),
  }),
  PhoneLoginDTO: t.Object({
    phone: t.String({ pattern: "^1[3-9]\\d{9}$", description: "手机号" }),
    code: t.String({ minLength: 4, maxLength: 6, description: "短信验证码" }),
  }),
  SendSmsCodeDTO: t.Object({
    phone: t.String({ pattern: "^1[3-9]\\d{9}$", description: "手机号" }),
  }),
  User: t.Omit(db.select.user, ["password", "phone"]),
});

export type AuthModel = InferModelsMap<typeof authModel>;
