import { treaty } from "@elysiajs/eden";
import type { App } from "@epinfresh/api";
import { createEdenHooks } from "./eden-hooks";

export const api = treaty<App>(import.meta.env.VITE_API_BASE_URL, {
  fetch: {
    credentials: "include", // 🔥 关键：告诉浏览器在跨域请求中带上 Cookie
  },
});

// 导出这个增强版的 hooks
export const query = createEdenHooks(api);
