import { getRequestId } from './requestContext'

export interface RequestMeta {
  ip: string | null
  userAgent: string | null
  requestId: string | null
}

export interface RequestMetaOptions {
  // 仅在可信代理后允许读转发头: x-forwarded-for / x-real-ip 是客户端可伪造的,
  // 不经代理直连时(或代理未覆盖该头)直接读取会把伪造 IP 落进审计/会话记录。
  trustProxy?: boolean
}

// 从请求提取审计/日志上下文; request-id 由 startServer 的 AsyncLocalStorage 注入。
// IP 只在 trustProxy 时从转发头解析; 直连场景不取 IP(宁缺毋假)。
export function requestMeta(request: Request, options: RequestMetaOptions = {}): RequestMeta {
  const trustProxy = options.trustProxy === true
  const forwarded = trustProxy ? request.headers.get('x-forwarded-for') : null
  const ip = forwarded
    ? (forwarded.split(',')[0]?.trim() ?? null)
    : trustProxy
      ? request.headers.get('x-real-ip')
      : null
  return {
    ip,
    userAgent: request.headers.get('user-agent'),
    requestId: getRequestId() ?? null,
  }
}
