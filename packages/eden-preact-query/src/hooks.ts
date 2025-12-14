import {
  type UseQueryResult,
  useEdenQuery,
  useEdenSuspenseQuery,
} from "./eden-query";

// --- 类型定义 ---

/**
 * 从 Eden Promise 返回类型中提取出实际的数据类型 T。
 * T 预期为 Promise<{ data: D; error: E }>
 */
type UnwrapEdenData<T> = T extends Promise<infer R>
  ? R extends { data: infer D; error: unknown }
    ? NonNullable<D>
    : never
  : never;

/**
 * 包装后的 HTTP 方法的类型。它既可以被调用，也包含查询 Hook。
 * @template Args 原始方法的参数类型。
 * @template Data 原始方法返回的数据类型。
 * @template Error 错误类型。
 */
type MethodWithHooks<Args extends unknown[], Data, Error> = {
  /** Suspense 模式的 Hook。*/
  useSuspenseQuery: () => Data;
  /** 标准模式的 Hook。*/
  useQuery: () => UseQueryResult<Data, Error>;

  /**
   * 带参数调用路由，返回一个仅包含 Hooks 的对象。
   * @param args 路由参数。
   */
  (
    ...args: Args
  ): {
    useSuspenseQuery: () => Data;
    useQuery: () => UseQueryResult<Data, Error>;
  };
};

/**
 * 递归映射原始 Eden Client 类型，将所有 HTTP 方法替换为 MethodWithHooks。
 * @template App 原始 Eden Client 的类型。
 * @template E 默认的错误类型。
 */
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

/**
 * 记录 Proxy 链式调用中的单个操作。
 */
type Operation =
  | { type: "get"; prop: string | symbol }
  | { type: "apply"; args: unknown[] };

/**
 * 创建 Eden Hooks 的运行时逻辑。通过 Proxy 拦截属性访问和函数调用。
 * @param edenClient 原始的 Eden API 客户端实例。
 */
function createEdenHooksRuntime(edenClient: unknown) {
  function createProxy(ops: Operation[] = []): unknown {
    // 内部函数：用于统一构建 Key 和 Fetcher
    const getQueryConfig = () => {
      // 1. 生成唯一 Key (包含路径和所有参数)
      const key = ops.map((op) =>
        op.type === "get" ? op.prop : { args: op.args },
      );

      // 2. 构建 Fetcher (还原原始 API 调用链)
      const fetcher = () => {
        let current: unknown = edenClient;
        for (const op of ops) {
          if (op.type === "get") {
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
      // 类型断言为 EdenFetcher 的预期返回类型，因为 Proxy 无法推断精确类型
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

/**
 * 将原始的 Eden API 客户端转换为带有 useQuery 和 useSuspenseQuery Hooks 的新客户端。
 * @template App 原始 Eden Client 的类型。
 * @template E 默认的错误类型。
 * @param client 原始 Eden Client 实例。
 * @returns EdenQueryHooks<App, E> 带有查询 Hooks 的包装客户端。
 */
export function createEdenHooks<App, E = unknown>(
  client: App,
): EdenQueryHooks<App, E> {
  return createEdenHooksRuntime(client) as EdenQueryHooks<App, E>;
}
