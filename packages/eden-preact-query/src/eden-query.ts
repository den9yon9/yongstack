import { createContext, h } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";

// --- Types ---

type QueryKey = string | readonly unknown[];
type EdenFetcher<T, E> = () => Promise<{ data: T | null; error: E | null }>;

interface QueryState<T> {
  data?: T;
  error?: unknown;
  status: "pending" | "success" | "error";
  promise?: Promise<T>;
}

// useQuery 的返回类型
interface UseQueryResult<T, E = unknown> extends QueryState<T> {
  isLoading: boolean; // status === 'pending'
  isSuccess: boolean; // status === 'success'
  isError: boolean; // status === 'error'
  // 保持与 QueryState 一致，但更明确地暴露出 data 和 error
  data?: T;
  error?: E;
}

type QueryObserver<T> = (state: QueryState<T>) => void;

// --- Query Client (The Brain) ---

export class QueryClient {
  // 使用 unknown 来表示缓存中的值类型是任意的
  private cache = new Map<string, QueryState<unknown>>();
  private listeners = new Map<string, Set<QueryObserver<unknown>>>();

  // 简单的序列化 key
  private serializeKey(key: QueryKey): string {
    return JSON.stringify(key);
  }

  getQueryState<T>(key: QueryKey): QueryState<T> | undefined {
    return this.cache.get(this.serializeKey(key)) as QueryState<T> | undefined;
  }

  // 核心 Fetch 逻辑
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
      promise,
      data: existing?.data,
    }); // 保留旧数据以支持 optimistic UI

    return promise;
  }

  // 更新状态并通知监听者
  private setQueryState(key: QueryKey, state: Partial<QueryState<unknown>>) {
    const hash = this.serializeKey(key);
    const current = this.cache.get(hash) || { status: "pending" };
    const next = { ...current, ...state };

    // 如果状态完成，移除 promise
    if (next.status !== "pending") delete next.promise;

    this.cache.set(hash, next);
    this.notify(hash, next);
  }

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

  private notify(hash: string, state: QueryState<unknown>) {
    this.listeners.get(hash)?.forEach((cb) => void cb(state));
  }

  // 手动失效/重新获取
  invalidate(key: QueryKey) {
    const hash = this.serializeKey(key);
    this.cache.delete(hash);
  }

  // 清空所有缓存 (用于登录/退出时)
  clear() {
    this.cache.clear();
    this.listeners.clear();
  }
}

// --- Context ---

const QueryContext = createContext<QueryClient | null>(null);

export const EdenQueryProvider = ({
  client,
  children,
}: {
  client: QueryClient;
  children: any;
}) => {
  return h(QueryContext.Provider, { value: client }, children);
};

// 导出 Hook 以便在组件中获取 client 实例
export function useQueryClient() {
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

  // 3. 如果没有状态或状态已失效，发起请求
  if (!state || (state.status !== "pending" && state.status !== "success")) {
    client.fetch(key, wrappedFetcher);
    // 立即设置一个 'pending' 状态作为初始值
    state = { status: "pending" };
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
