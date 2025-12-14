import {
  type UseQueryResult,
  useEdenQuery,
  useEdenSuspenseQuery,
} from "./eden-query";

// --- 类型定义 ---

// 提取 Eden Promise 中的 Data 类型
// R 是 { data: D; error: E }
type UnwrapEdenData<T> = T extends Promise<infer R>
  ? R extends { data: infer D; error: unknown }
    ? NonNullable<D>
    : never
  : never;

// 定义混合类型：既是函数(接收参数) 也是对象(包含所有 Hook)
type MethodWithHooks<Args extends unknown[], Data, Error> = {
  // 1. 无参调用: api.get.useSuspenseQuery()
  useSuspenseQuery: () => Data;
  useQuery: () => UseQueryResult<Data, Error>;

  // 2. 带参调用: api.get({ query }).useSuspenseQuery()
  // 返回一个只有 Hook 的对象
  (
    ...args: Args
  ): {
    useSuspenseQuery: () => Data;
    useQuery: () => UseQueryResult<Data, Error>;
  };
};

// 递归映射 Eden Client 类型
// App 是原始 Eden Client 的类型
export type EdenQueryHooks<App, E = unknown> = {
  [K in keyof App]: App[K] extends (...args: infer Args) => infer R
    ? R extends Promise<unknown>
      ? // 如果是 HTTP 方法 (返回 Promise)，转换为混合类型
        MethodWithHooks<Args, UnwrapEdenData<R>, E>
      : // 如果是路由构建函数，递归处理
        ((...args: Args) => EdenQueryHooks<R, E>) & EdenQueryHooks<R, E>
    : // 普通对象属性，递归处理
      EdenQueryHooks<App[K], E>;
};

// --- 运行时逻辑 (Proxy) ---

type Operation =
  | { type: "get"; prop: string | symbol }
  | { type: "apply"; args: unknown[] };

// 使用 unknown 来接受原始客户端
function createEdenHooksRuntime(edenClient: unknown) {
  function createProxy(ops: Operation[] = []): unknown {
    // 内部函数：用于统一构建 Key 和 Fetcher
    const getQueryConfig = () => {
      // 1. 生成唯一 Key
      const key = ops.map((op) =>
        op.type === "get" ? op.prop : { args: op.args },
      );

      // 2. 构建 Fetcher
      const fetcher = () => {
        let current: unknown = edenClient;
        for (const op of ops) {
          if (op.type === "get") {
            // 使用 as any 逃避 Proxy 链上对 current 类型的限制
            current = (current as any)[op.prop];
          } else if (op.type === "apply") {
            current = (current as any)(...op.args);
          }
        }
        // 如果最后一步是方法(get/post)本身，需要执行它
        return typeof current === "function"
          ? (current as () => Promise<unknown>)()
          : (current as Promise<unknown>);
      };
      return { key, fetcher: fetcher as any };
    };

    // Proxy 陷阱
    return new Proxy(() => {}, {
      // 拦截属性访问: .user, .get, .useSuspenseQuery, .useQuery
      get: (_target, prop) => {
        if (prop === "useSuspenseQuery") {
          // 触发 Suspense Hook
          return () => {
            const { key, fetcher } = getQueryConfig();
            return useEdenSuspenseQuery(key, fetcher);
          };
        }

        if (prop === "useQuery") {
          // 触发 Standard Hook
          return () => {
            const { key, fetcher } = getQueryConfig();
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

// 最终导出函数，通过泛型 App 保证外部的类型安全
export function createEdenHooks<App, E = unknown>(
  client: App,
): EdenQueryHooks<App, E> {
  return createEdenHooksRuntime(client) as EdenQueryHooks<App, E>;
}
