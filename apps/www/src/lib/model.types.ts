// 你的模块文件
import type { App } from "@epinfresh/api";
import type { AnyElysia, Static } from "elysia";

type InferModel<
  TApp extends AnyElysia,
  K extends keyof TApp["models"],
> = Static<ReturnType<TApp["models"][K]["Schema"]>>;

/**
 * 从 Elysia App 类型中提取所有 Model 定义，并将其映射成一个“类型字典”。
 * @template TApp - Elysia App 的类型
 * @returns 一个类型字典，键为 Model 名称，值为对应的 Model 静态类型。
 */
type InferModelsMap<TApp extends AnyElysia> = {
  [K in keyof TApp["models"]]: InferModel<TApp, K>;
};

export type Models = InferModelsMap<App>;
