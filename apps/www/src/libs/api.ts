import type { paths } from "@yongstack/openapi";
import createClient from "openapi-fetch";
// https://github.com/openapi-ts/openapi-typescript/pull/1970#ref-issue-4064628551
export const api = createClient<paths>({ baseUrl: "http://localhost:8080" });
