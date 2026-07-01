import Elysia, { t } from "elysia";
import type { InferModelsMap } from "../../lib/InferModel";

export const fileModel = new Elysia().model({
  UploadFileDTO: t.Object({
    file: t.File({
      maxSize: 10 * 1024 * 1024,
      type: ["image/jpeg", "image/png", "image/webp"],
    }),
  }),
});

export type FileModel = InferModelsMap<typeof fileModel>;
