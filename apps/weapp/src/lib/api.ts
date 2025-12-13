import { treaty } from "@elysiajs/eden";
import type { App } from "@epinfresh/api";
import "./elysia-wx-polyfill";
import fetchProxy from "./elysia-wx-polyfill";

export const api = treaty<App>("http://localhost:8080", {
  fetcher: fetchProxy as any,
});
