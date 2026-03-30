import createClient from "openapi-fetch";
import type { paths } from "./schema.gen";

export const api = createClient<paths>({ baseUrl: "http://localhost:8080" });
