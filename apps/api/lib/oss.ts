import { t } from "elysia";
import { env } from "./env";

const BASE_URL = env.API_PUBLIC_URL.replace(/\/?$/, "/");

export const AssetUrl = t
  .Transform(t.Union([t.String(), t.Null()]))
  .Decode((path) => {
    if (!path || path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    return path;
  })
  .Encode((path) => {
    if (!path || path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    return `${BASE_URL}${path.replace(/^\//, "")}`;
  });
