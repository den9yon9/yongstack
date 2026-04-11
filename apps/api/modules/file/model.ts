import Elysia, { t } from "elysia";
import type { InferModelsMap } from "@/lib/InferModel";

export const fileModel = new Elysia().model({
  UploadDTO: t.Union([
    // 头像场景
    t.Object({
      scene: t.Literal("avatar"),
      file: t.File({
        maxSize: 5 * 1024 * 1024,
        type: ["image/jpeg", "image/png", "image/webp"],
      }),
    }),
    // 聊天场景
    t.Object({
      scene: t.Literal("chat"),
      file: t.File({
        maxSize: 10 * 1024 * 1024,
        type: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      }),
    }),
  ]),
  UploadResponse: t.Object({
    url: t.String(),
  }),
});

export type FileModel = InferModelsMap<typeof fileModel>;
