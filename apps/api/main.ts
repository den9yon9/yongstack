import cors from "@elysiajs/cors";
import swagger from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { env } from "./lib/env";
import { auth } from "./modules/auth";
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
  .use(swagger())
  .use(cors({ origin: ["http://localhost:5173"], credentials: true }))
  .use(auth)
  .use(user)
  .get("/", () => ({
    hello: "Elysia",
  }))
  .listen(env.PORT);

console.log(`Listening on ${app.server?.url}`);

export type App = typeof app; // 辅助类型：从 ModelValidator<S> 中解包出 S
