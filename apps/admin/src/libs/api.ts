import type { paths } from "@yongstack/openapi";
import createClient from "@yongstack/openapi-fetch";
export const api = createClient<paths>({ baseUrl: "http://localhost:8080" });
