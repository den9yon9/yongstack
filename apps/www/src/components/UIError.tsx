import { useCallback } from "preact/hooks";
import { useLocation } from "wouter-preact";

interface UIErrorProps {
  /** 错误对象 */
  // biome-ignore lint/suspicious/noExplicitAny: UI组件需要处理各种未知结构抛出的错误，使用any是最务实的
  error?: any;
  /** 重试回调函数 */
  resetErrorBoundary?: () => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义标题 */
  title?: string;
}

export default function UIError({
  error,
  resetErrorBoundary,
  className = "",
  title,
}: UIErrorProps) {
  // 使用 wouter 的 hook 进行页面跳转
  const [, setLocation] = useLocation();

  // 1. 判断是否为 401 未授权错误
  // Elysia Eden 的错误对象通常包含 status 字段
  const isUnauthorized =
    error?.status === 401 ||
    error?.message?.includes("401") ||
    error?.message?.includes("Unauthorized");

  // 2. 根据错误类型决定显示的标题和信息
  const displayTitle = title || (isUnauthorized ? "登录已过期" : "出错了");

  const errorMessage = isUnauthorized
    ? "您的登录状态已失效，请重新登录"
    : typeof error === "string"
      ? error
      : error?.value || error?.message || JSON.stringify(error) || "未知错误";

  // 3. 处理重试逻辑
  const handleRetry = useCallback(() => {
    if (resetErrorBoundary) {
      resetErrorBoundary();
    } else {
      window.location.reload();
    }
  }, [resetErrorBoundary]);

  // 4. 处理登录跳转逻辑
  const handleLogin = useCallback(() => {
    // 这里假设你的登录页路由是 /login
    setLocation("~/login");
    // 跳转前最好重置一下错误状态，以免路由切换回来时 ErrorBoundary 还在生效
    resetErrorBoundary?.();
  }, [setLocation, resetErrorBoundary]);

  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 w-full h-full min-h-[250px] bg-base-100/50 rounded-xl ${className}`}
    >
      {/* 动态图标：401显示锁，其他显示警告 */}
      <div className="w-16 h-16 mb-4 rounded-full bg-base-200 flex items-center justify-center">
        {isUnauthorized ? (
          // 🔒 锁图标
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-8 h-8 text-warning"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        ) : (
          // ⚠️ 错误图标
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-8 h-8 text-error"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        )}
      </div>

      <h3 className="text-lg font-bold text-base-content mb-2">
        {displayTitle}
      </h3>

      <p className="text-sm text-base-content/60 max-w-xs break-words mb-6 leading-relaxed">
        {errorMessage}
      </p>

      {/* 根据错误类型显示不同的按钮 */}
      {isUnauthorized ? (
        <button
          onClick={handleLogin}
          className="btn btn-sm btn-primary shadow-sm px-6"
        >
          前往登录
        </button>
      ) : (
        <button
          onClick={handleRetry}
          className="btn btn-sm btn-outline shadow-sm px-6"
        >
          重试
        </button>
      )}
    </div>
  );
}
