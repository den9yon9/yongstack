/**
 * 微信小程序 wx.request 到 Web Fetch API 的适配器
 * 用于支持 openapi-fetch 等基于标准 fetch 的运行库
 */

/**
 * 扩展标准 Response 接口，方便把微信原生的 cookies 传递给拦截器
 */
export interface WxResponse extends Response {
  /** 微信原生解析好的 Cookie 数组 */
  _wxCookies?: string[];
}

/**
 * 转换 Headers 对象为微信小程序支持的普通对象
 * @param headers Fetch API 的 HeadersInit 对象
 * @returns 微信小程序接受的 header 对象
 */
const parseHeaders = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return headers as Record<string, string>;
};

/**
 * 模拟 Fetch 函数
 * @param input 请求 URL
 * @param init 请求配置参数
 * @returns 模拟的 Web Response 对象
 */
export const wxFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<WxResponse> => {
  const requestUrl = typeof input === "string" ? input : input.toString();
  const wxHeaders = parseHeaders(init?.headers);

  return new Promise((resolve, reject) => {
    wx.request({
      url: requestUrl,
      method: (init?.method ||
        "GET") as WechatMiniprogram.RequestOption["method"],
      data: init?.body as any,
      header: wxHeaders,
      success: (res) => {
        // 构造一个满足 openapi-fetch 最小需求的伪 Response 对象
        const response: Partial<WxResponse> = {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          url: requestUrl,
          _wxCookies: res.cookies, // 注入微信原生 cookies 供拦截器使用
          headers: {
            get: (name: string) => {
              const lowerName = name.toLowerCase();
              // 匹配原始键名或小写键名
              const key = Object.keys(res.header).find(
                (k) => k.toLowerCase() === lowerName,
              );
              return key ? res.header[key] : null;
            },
          } as unknown as Headers,
          // JSON 序列化方法
          json: async () => res.data,
          text: async () =>
            typeof res.data === "string" ? res.data : JSON.stringify(res.data),
        };

        resolve(response as WxResponse);
      },
      fail: (err) => {
        // 统一抛出错误，触发 openapi-fetch 的异常处理
        reject(new Error(err.errMsg));
      },
    });
  });
};
