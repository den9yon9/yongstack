// apps/api/modules/user/index.ts

import Elysia from "elysia";
import { isAuthenticated } from "../../lib/guard";
import { authModel } from "../auth/model"; // 引入 auth 的 User Model
import { userModel } from "./model";
import { getMine, updateMine } from "./service";

export const user = new Elysia({
  prefix: "/user",
})
  .use(userModel)
  .use(authModel)
  .use(isAuthenticated)
  .get("/mine", ({ userId }) => getMine(userId), {
    response: "User",
  })
  .put("/mine", ({ userId, body }) => updateMine(userId, body), {
    body: "UpdateUserDTO",
    response: "User",
  });
