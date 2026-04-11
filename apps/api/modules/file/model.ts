// apps/api/modules/file/model.ts
import Elysia, { t } from "elysia";

// 1. 定义业务场景规则字典
export const SCENE_RULES = {
  avatar: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    dir: "avatars",
  },
  chat_image: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ["image/jpeg", "image/png", "image/gif"],
    dir: "chat",
  },
} as const;

export type UploadScene = keyof typeof SCENE_RULES;

// 2. 定义 API 的入参结构
export const fileModel = new Elysia().model({
  UploadDTO: t.Object({
    // t.File 是 Elysia 原生支持的，这里做最外层的兜底限制 (比如整个系统最大不超 20MB)
    file: t.File({ maxSize: 20 * 1024 * 1024 }),
    scene: t.KeyOf(
      t.Object({
        avatar: t.String(),
        chat_image: t.String(),
      }),
    ),
  }),
  UploadResponse: t.Object({
    url: t.String(),
  }),
});
