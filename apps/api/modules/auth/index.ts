import Elysia from "elysia";
import { authModel } from "./model";
import {
  loginWithPassword,
  registerWithPassword,
  wechatLogin,
} from "./service";

export const auth = new Elysia({
  prefix: "/auth",
})
  .use(authModel)
  .post(
    "/wechat/login",
    async ({ body, cookie }) => {
      const user = await wechatLogin(body.code);
      cookie.userId.value = user.id.toString();
      return user;
    },
    {
      body: "WechatLogin",
      response: "User",
    },
  )
  .post(
    "/register",
    async ({ body, cookie }) => {
      const user = await registerWithPassword(body);
      cookie.userId.value = user.id.toString();
      return user;
    },
    {
      body: "RegisterDTO",
      response: "User",
    },
  )
  .post(
    "/login",
    async ({ body, cookie }) => {
      const user = await loginWithPassword(body);
      cookie.userId.value = user.id.toString();
      return user;
    },
    {
      body: "LoginDTO",
      response: "User",
    },
  )
  .post("/logout", ({ cookie }) => {
    cookie.userId.remove();
    return { success: true };
  });
