import cors from "@elysiajs/cors";
import openapi from "@elysiajs/openapi";
import { Elysia, t } from "elysia";
import { env } from "./lib/env";
import { auth } from "./modules/auth";
import { file } from "./modules/file";
import { user } from "./modules/user";

const app = new Elysia({
  cookie: {
    sign: true,
    secrets: env.COOKIE_SECRET,
    httpOnly: true,
    sameSite: "lax", // 在 localhost 调试时 lax 通常没问题
    path: "/",
  },
})
  .use(openapi())
  .guard({
    response: {
      500: t.Unknown(),
    },
  })
  .use(
    cors({
      origin: ["http://localhost:5173", "http://localhost:3000"],
      credentials: true,
    }),
  )
  .use(auth)
  .use(user)
  .use(file)
  .get("/", () => ({
    hello: "Elysia",
  }))
  .listen(env.PORT);

console.log(`Listening on ${app.server?.url}`);

export type App = typeof app; // 辅助类型：从 ModelValidator<S> 中解包出 S
