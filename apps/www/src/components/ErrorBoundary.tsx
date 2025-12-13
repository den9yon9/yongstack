import {
  Component,
  type ComponentChildren,
  isValidElement,
  type VNode,
} from "preact";
import UIError from "./UIError";

interface Props {
  children: ComponentChildren;
  /**
   * 可选：自定义 Fallback UI。
   * 可以是一个 ReactElement，或者一个接收 error 和 reset 的函数
   */
  fallback?: VNode | ((props: { error: unknown; reset: () => void }) => VNode);
  /**
   * 可选：发生错误时的回调，用于上报 Sentry 等监控平台
   */
  onError?: (error: unknown, errorInfo: unknown) => void;

  /**
   * 可选：重置时的回调（例如清理某些全局状态）
   */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: unknown;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // 1. 捕获错误并更新 State，触发降级 UI 渲染
  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  // 2. 捕获错误堆栈，通常用于日志上报
  componentDidCatch(error: unknown, errorInfo: unknown) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    } else {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }
  }

  // 3. 提供给 Fallback 组件的重试方法
  reset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      const { error } = this.state;

      // 情况 A: 用户提供了函数式的 fallback (Render Prop)
      if (typeof fallback === "function") {
        return fallback({ error, reset: this.reset });
      }

      // 情况 B: 用户提供了静态的 VNode
      if (isValidElement(fallback)) {
        return fallback;
      }

      // 情况 C: 默认使用我们封装好的 UIError 组件
      return <UIError error={error} resetErrorBoundary={this.reset} />;
    }

    return this.props.children;
  }
}

/**
 * 一个高阶组件 (HOC) 辅助函数，
 * 用于快速给某个组件包裹 ErrorBoundary
 */
export function withErrorBoundary<P extends object = object>(
  // biome-ignore lint/suspicious/noExplicitAny: HOC generic
  ComponentToWrap: any,
  errorBoundaryProps?: Omit<Props, "children">,
) {
  return (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <ComponentToWrap {...props} />
    </ErrorBoundary>
  );
}
