import cors from "@elysiajs/cors";
import { Elysia } from "elysia";
import { auth } from "./modules/auth";

if (!process.env.COOKIE_SECRET) throw new Error("COOKIE_SECRET not set");

const app = new Elysia({
  cookie: {
    sign: true,
    secrets: process.env.COOKIE_SECRET,
    httpOnly: true,
    sameSite: "lax", // 在 localhost 调试时 lax 通常没问题
    path: "/",
  },
})
  .use(
    cors({
      origin: ["http://localhost:5173"],
      credentials: true,
    }),
  )
  .use(auth)
  .get("/", () => ({
    hello: "Elysia",
  }))
  .listen(8080);

console.log(`Listening on ${app.server?.url}`);

export type App = typeof app;
