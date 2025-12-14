import { treaty } from "@elysiajs/eden";
import type { App } from "@epinfresh/api";
import { createEdenHooks } from "./eden-hooks";

export const api = treaty<App>(import.meta.env.VITE_API_BASE_URL, {
  fetch: { credentials: "include" },
});

export const query = createEdenHooks(api);
