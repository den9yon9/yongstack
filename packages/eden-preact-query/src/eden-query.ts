import { createContext, h } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";

// --- Types ---

/**
 * 查询键，用于缓存的唯一标识。可以是字符串或只读数组（包含参数和路径）。
 */
type QueryKey = string | readonly unknown[];

/**
 * Eden 风格的异步数据获取函数签名。
 * @template T 成功时返回的数据类型。
 * @template E 失败时返回的错误类型。
 */
type EdenFetcher<T, E> = () => Promise<{ data: T | null; error: E | null }>;

/**
 * 缓存中存储的查询状态。
 * @template T 数据的类型。
 */
interface QueryState<T> {
  data?: T;
  error?: unknown;
  status: "pending" | "success" | "error";
  promise?: Promise<T>;
}

/**
 * useQuery Hook 的返回结果。
 * @template T 数据的类型。
 * @template E 错误的类型。
 */
interface UseQueryResult<T, E = unknown> extends QueryState<T> {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  data?: T;
  error?: E;
}

/**
 * 状态监听器签名。
 * @template T 数据的类型。
 */
type QueryObserver<T> = (state: QueryState<T>) => void;

// --- Query Client (The Brain) ---

/**
 * 核心查询客户端，负责缓存、数据获取、请求去重和状态通知。
 */
export class QueryClient {
  private cache = new Map<string, QueryState<unknown>>();
  private listeners = new Map<string, Set<QueryObserver<unknown>>>();

  /**
   * 简单的序列化 key。
   */
  private serializeKey(key: QueryKey): string {
    return JSON.stringify(key);
  }

  /**
   * 从缓存中获取特定 key 的查询状态。
   * @template T 数据的类型。
   * @param key 查询键。
   */
  getQueryState<T>(key: QueryKey): QueryState<T> | undefined {
    return this.cache.get(this.serializeKey(key)) as QueryState<T> | undefined;
  }

  /**
   * 核心 Fetch 逻辑。处理请求去重，并更新状态。
   * @template T 数据的类型。
   * @param key 查询键。
   * @param fetcher 实际执行数据请求的函数。
   */
  fetch<T>(key: QueryKey, fetcher: () => Promise<T>): Promise<T> {
    // 如果已经在请求中，直接返回现有的 Promise (请求去重)
    const existing = this.getQueryState<T>(key);
    if (existing?.status === "pending" && existing.promise) {
      return existing.promise;
    }

    const promise = fetcher()
      .then((data) => {
        this.setQueryState(key, { status: "success", data, error: undefined });
        return data;
      })
      .catch((error) => {
        this.setQueryState(key, { status: "error", error, data: undefined });
        throw error;
      });

    this.setQueryState(key, {
      status: "pending",
      promise: promise as Promise<unknown>,
      data: existing?.data,
    }); // 保留旧数据以支持 optimistic UI

    return promise;
  }

  /**
   * 更新状态并通知所有监听者。
   */
  private setQueryState(key: QueryKey, state: Partial<QueryState<unknown>>) {
    const hash = this.serializeKey(key);
    const current = this.cache.get(hash) || { status: "pending" };
    const next = { ...current, ...state };

    // 如果状态完成，移除 promise
    if (next.status !== "pending") delete next.promise;

    this.cache.set(hash, next);
    this.notify(hash, next);
  }

  /**
   * 订阅特定 key 的状态变化。
   * @param key 查询键。
   * @param listener 状态变化时触发的回调函数。
   * @returns 取消订阅函数。
   */
  subscribe(key: QueryKey, listener: QueryObserver<unknown>) {
    const hash = this.serializeKey(key);
    if (!this.listeners.has(hash)) {
      this.listeners.set(hash, new Set());
    }
    this.listeners.get(hash)?.add(listener);

    return () => {
      this.listeners.get(hash)?.delete(listener);
      if (this.listeners.get(hash)?.size === 0) {
        this.listeners.delete(hash);
      }
    };
  }

  /**
   * 通知特定 key 的所有监听者。
   */
  private notify(hash: string, state: QueryState<unknown>) {
    this.listeners.get(hash)?.forEach((cb) => void cb(state));
  }

  /**
   * 手动使特定 key 的缓存失效（清除缓存）。
   * @param key 查询键。
   */
  invalidate(key: QueryKey) {
    const hash = this.serializeKey(key);
    this.cache.delete(hash);
  }

  /**
   * 清空所有缓存和监听者 (用于登录/退出时)。
   */
  clear() {
    this.cache.clear();
    this.listeners.clear();
  }
}

// --- Context ---

const QueryContext = createContext<QueryClient | null>(null);

/**
 * 根 Provider 组件，用于将 QueryClient 实例注入到组件树。
 */
export const EdenQueryProvider = ({
  client,
  children,
}: {
  client: QueryClient;
  children: any;
}) => {
  return h(QueryContext.Provider, { value: client }, children);
};

/**
 * 用于在组件中获取 QueryClient 实例的 Hook。
 * @returns QueryClient 实例。
 */
export function useQueryClient(): QueryClient {
  const client = useContext(QueryContext);
  if (!client) throw new Error("No EdenQueryProvider found");
  return client;
}

// --- 辅助函数：将 Eden Fetcher 转换为内部 Fetcher ---
const wrapEdenFetcher =
  <T, E>(fetcher: EdenFetcher<T, E>) =>
  async () => {
    const res = await fetcher();
    if (res.error) {
      throw res.error; // 将 Eden 的 error 转换为 Promise rejection
    }
    return res.data as T;
  };

// --- The Suspense Hook ---

/**
 * Suspense 模式的查询 Hook。
 * - 成功时返回数据。
 * - 加载中时抛出 Promise。
 * - 错误时抛出 Error。
 * @template T 数据的类型。
 * @template E 错误的类型。
 * @param key 查询键。
 * @param fetcher Eden 风格的数据获取函数。
 * @returns T 成功获取的数据。
 */
export function useEdenSuspenseQuery<T, E = unknown>(
  key: QueryKey,
  fetcher: EdenFetcher<T, E>,
): T {
  const client = useQueryClient();
  const wrappedFetcher = wrapEdenFetcher(fetcher);

  // 1. 获取当前状态
  const state = client.getQueryState<T>(key);

  // 2. 强制更新 (用于监听缓存变化)
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    return client.subscribe(key, () => {
      forceUpdate((c) => c + 1);
    });
  }, [client, key]);

  // 3. Suspense 逻辑的核心

  // Case A: 成功 -> 返回数据
  if (state?.status === "success" && state.data !== undefined) {
    return state.data;
  }

  // Case B: 错误 -> 抛出错误 (让 ErrorBoundary 捕获)
  if (state?.status === "error") {
    throw state.error;
  }

  // Case C: 正在加载 -> 抛出 Promise (让 Suspense 捕获)
  if (state?.status === "pending") {
    throw state.promise;
  }

  // Case D: 初始化 (还没有发起过请求) -> 发起请求并抛出 Promise
  const promise = client.fetch(key, wrappedFetcher);

  throw promise;
}

// --- The Standard Hook ---

/**
 * 标准（非 Suspense）查询 Hook。
 * - 手动处理 isLoading, isError, data 状态。
 * - 错误状态下不会自动重试，等待手动操作或组件重挂载。
 * @template T 数据的类型。
 * @template E 错误的类型。
 * @param key 查询键。
 * @param fetcher Eden 风格的数据获取函数。
 * @returns UseQueryResult<T, E> 包含状态信息的对象。
 */
export function useEdenQuery<T, E = unknown>(
  key: QueryKey,
  fetcher: EdenFetcher<T, E>,
): UseQueryResult<T, E> {
  const client = useQueryClient();
  const wrappedFetcher = wrapEdenFetcher(fetcher);

  // 1. 获取当前状态
  let state = client.getQueryState<T>(key);

  // 2. 强制更新 (用于监听缓存变化)
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    return client.subscribe(key, () => {
      forceUpdate((c) => c + 1);
    });
  }, [client, key]);

  // 3. 只有在没有状态或状态不是 'pending' 且不是 'success' 时，才发起请求。
  //    如果状态是 'error'，它将直接返回错误结果，防止自动无限重试。
  if (!state || (state.status !== "pending" && state.status !== "success")) {
    if (state?.status !== "error") {
      client.fetch(key, wrappedFetcher);
      // 立即设置一个 'pending' 状态作为初始值
      state = { status: "pending" };
    }
  }

  // 4. 组合并返回结果对象
  const resultState: QueryState<T> = state || { status: "pending" };

  return {
    ...resultState,
    // 暴露出方便使用的布尔值
    isLoading: resultState.status === "pending",
    isSuccess: resultState.status === "success",
    isError: resultState.status === "error",
    data: resultState.data,
    error: resultState.error as E | undefined,
  } as UseQueryResult<T, E>;
}

export type { UseQueryResult };
