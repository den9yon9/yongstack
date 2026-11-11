'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from './button'

export interface ErrorBoundaryProps {
  children: ReactNode
  title?: string
  onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

// 兜底渲染错误(路由级错误由 TanStack Router 处理): 避免整页白屏, 并提供重试。
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  private reset = () => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-lg font-semibold">{this.props.title ?? '页面出错了'}</h1>
          <p className="max-w-lg text-sm text-muted-foreground">{this.state.error.message}</p>
          <div className="flex gap-2">
            <Button onClick={this.reset}>重试</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
