import createClient from "openapi-fetch";
import { type WxResponse, wxFetch } from "../wxFetch";
import type { paths } from "./schema";

/** 本地存储 Cookie 的 Key */
const COOKIE_STORAGE_KEY = "app_api_cookies";

/**
 * 初始化 OpenAPI Fetch 客户端
 */
export const api = createClient<paths>({
  baseUrl: "https://your-api-server.com/api", // 替换为你的真实 API 域名
  fetch: wxFetch as any, // 强制注入微信适配器
});

/**
 * 注册中间件：处理请求和响应（相当于 Axios 的拦截器）
 */
api.use({
  /**
   * 请求拦截器：自动注入本地保存的 Cookie 或 Token
   */
  onRequest({ request }) {
    // 1. 获取本地存储的 Cookie
    const savedCookies = wx.getStorageSync(COOKIE_STORAGE_KEY) as string[];

    if (savedCookies && savedCookies.length > 0) {
      // 按照 HTTP 规范用分号拼接发送
      request.headers.set("Cookie", savedCookies.join("; "));
    }

    // [可选] 如果你需要使用 Token 鉴权，在这里注入：
    // const token = wx.getStorageSync('access_token');
    // if (token) {
    //   request.headers.set('Authorization', `Bearer ${token}`);
    // }

    return request;
  },

  /**
   * 响应拦截器：自动提取 Set-Cookie 并保存到本地
   */
  onResponse({ response }) {
    // 将 response 断言为我们自定义的 WxResponse 类型
    const wxRes = response as WxResponse;

    // 2. 利用微信原生提供的 res.cookies (比解析 header 更准，避免多个 Cookie 合并解析错误)
    if (wxRes._wxCookies && wxRes._wxCookies.length > 0) {
      wx.setStorageSync(COOKIE_STORAGE_KEY, wxRes._wxCookies);
    }

    return response;
  },
});
