import type { App } from "@yongstack/api";
import { createEdenQuery } from "eden-tanstack-query";
export const api = createEdenQuery<App>("http://localhost:8080", {
  treaty: {
    fetch: { credentials: "include" },
  },
});
