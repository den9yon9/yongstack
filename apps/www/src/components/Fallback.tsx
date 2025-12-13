/**
 * 通用的 Loading 占位组件
 * 设计为填充父容器，适用于 Suspense fallback
 */
interface FallbackProps {
  /** 自定义类名，用于覆盖默认的高度或内边距 */
  className?: string;
  /** 加载提示文字，默认为空 */
  text?: string;
}

export default function Fallback({ className = "", text }: FallbackProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-4 w-full h-full min-h-[200px] text-gray-400/80 ${className}`}
    >
      <span className="loading loading-spinner loading-lg text-primary"></span>
      {text && (
        <span className="mt-3 text-sm font-medium animate-pulse">{text}</span>
      )}
    </div>
  );
}
