// apps/api/modules/file/index.ts
import Elysia from "elysia";
import { isAuthenticated } from "../../lib/guard";
import { fileModel } from "./model";
import { processUpload } from "./service";

export const file = new Elysia({ prefix: "/common" })
  .use(fileModel)
  .use(isAuthenticated) // 核心防线：必须登录
  .post(
    "/upload",
    async ({ userId, body }) => {
      // 调用 Service 处理上传
      const url = await processUpload(userId, body.file, body.scene as any);

      return { url };
    },
    {
      body: "UploadDTO",
      response: "UploadResponse",
    },
  );
