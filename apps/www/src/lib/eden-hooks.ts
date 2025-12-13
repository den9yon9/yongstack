/* biome-ignore-all lint/suspicious/noExplicitAny: library generic constraints require any */

import { useEdenQuery } from "./eden-query";

// --- 类型定义 ---

// 提取 Eden Promise 中的 Data 类型
type UnwrapEdenData<T> = T extends Promise<infer R>
  ? R extends { data: infer D; error: any }
    ? NonNullable<D>
    : never
  : never;

// 定义混合类型：既是函数(接收参数) 也是对象(包含 useQuery)
type MethodWithQuery<Args extends any[], Data> = {
  // 1. 无参调用: api.get.useQuery()
  useQuery: () => Data;

  // 2. 带参调用: api.get({ query }).useQuery()
  // 返回一个只有 useQuery 的对象
  (...args: Args): { useQuery: () => Data };
};

// 递归映射 Eden Client 类型
export type EdenQueryHooks<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer R
    ? R extends Promise<any>
      ? // 如果是 HTTP 方法 (返回 Promise)，转换为混合类型
        MethodWithQuery<Args, UnwrapEdenData<R>>
      : // 如果是路由构建函数，递归处理
        ((...args: Args) => EdenQueryHooks<R>) & EdenQueryHooks<R>
    : // 普通对象属性，递归处理
      EdenQueryHooks<T[K]>;
};

// --- 运行时逻辑 (Proxy) ---

type Operation =
  | { type: "get"; prop: string | symbol }
  | { type: "apply"; args: any[] };

function createEdenHooksRuntime(edenClient: any) {
  function createProxy(ops: Operation[] = []): any {
    return new Proxy(() => {}, {
      // 拦截属性访问: .user, .get, .useQuery
      get: (_target, prop) => {
        if (prop === "useQuery") {
          // --- 触发 Hook ---
          return () => {
            // 1. 生成唯一 Key (包含路径和所有参数)
            const key = ops.map((op) =>
              op.type === "get" ? op.prop : { args: op.args },
            );

            // 2. 构建 Fetcher
            const fetcher = () => {
              let current = edenClient;
              for (const op of ops) {
                if (op.type === "get") {
                  current = current[op.prop];
                } else if (op.type === "apply") {
                  current = current(...op.args);
                }
              }
              // 如果最后一步是方法(get/post)本身，需要执行它
              // 但如果是带参数的 api.get({query})，最后的 op 已经是 apply 了，current 已经是 Promise
              // 这里做一个简单判断
              return typeof current === "function" ? current() : current;
            };

            return useEdenQuery(key, fetcher);
          };
        }

        // 记录路径
        return createProxy([...ops, { type: "get", prop }]);
      },

      // 拦截函数调用: .user({id}), .get({query})
      apply: (_target, _thisArg, args) => {
        // 记录参数
        return createProxy([...ops, { type: "apply", args }]);
      },
    });
  }

  return createProxy();
}

// --- 导出 ---

export function createEdenHooks<App>(client: App): EdenQueryHooks<App> {
  return createEdenHooksRuntime(client) as any;
}
