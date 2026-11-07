import { getRequestId } from './requestContext'

export interface RequestMeta {
  ip: string | null
  userAgent: string | null
  requestId: string | null
}

// 从请求提取审计/日志上下文; request-id 由 startServer 的 AsyncLocalStorage 注入。
export function requestMeta(request: Request): RequestMeta {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip')
  return {
    ip,
    userAgent: request.headers.get('user-agent'),
    requestId: getRequestId() ?? null,
  }
}
