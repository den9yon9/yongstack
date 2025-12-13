/**
 * @file elysia-wx-polyfill.ts
 * @description 微信小程序环境针对 Elysia Eden 的 Polyfill 适配器 (含 Cookie 支持)。
 */

// 获取全局对象
const g = globalThis as any;

// === 🍪 Cookie 管理逻辑 (新增) ===
const COOKIE_STORAGE_KEY = "weapp_cookies";

/**
 * 解析 Set-Cookie 字符串并更新本地存储
 * 支持处理形如 "key=value; Path=/" 的格式
 */
function updateCookies(setCookieHeader: string) {
  if (!setCookieHeader) return;

  // 获取旧 Cookie
  const cookies = wx.getStorageSync(COOKIE_STORAGE_KEY) || {};

  // 处理可能出现的多个 Set-Cookie (微信有时会用逗号分隔，有时是数组，这里主要处理字符串)
  // 正则说明：分割逗号，但要排除掉日期格式里的逗号（如 Expires=Wed, 21 Oct...）
  // 简单策略：Elysia 的 Session Cookie 通常很简单，主要匹配 "Key=Value;" 结构
  const cookieParts = setCookieHeader.split(/,(?=\s*[a-zA-Z0-9_-]+=)/);

  cookieParts.forEach((part) => {
    // 取分号前的部分作为 key=value
    const firstSemi = part.indexOf(";");
    const pair = firstSemi > -1 ? part.substring(0, firstSemi) : part;

    const eqIdx = pair.indexOf("=");
    if (eqIdx > -1) {
      const key = pair.substring(0, eqIdx).trim();
      const value = pair.substring(eqIdx + 1).trim();
      cookies[key] = value;
    }
  });

  // 保存回 Storage
  wx.setStorageSync(COOKIE_STORAGE_KEY, cookies);
}

/**
 * 获取用于请求头的 Cookie 字符串
 */
function getCookieHeaderString(): string {
  const cookies = wx.getStorageSync(COOKIE_STORAGE_KEY) || {};
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

// === End Cookie Logic ===

class HeadersProxy {
  private map: Record<string, string> = {};

  constructor(init?: Record<string, string> | HeadersProxy) {
    if (init) {
      if (init instanceof HeadersProxy) {
        init.forEach((v, k) => void this.append(k, v));
      } else {
        Object.keys(init).forEach((key) => {
          this.append(key, init[key]!);
        });
      }
    }
  }

  append(key: string, value: string) {
    this.map[key.toLowerCase()] = value;
  }

  set(key: string, value: string) {
    this.map[key.toLowerCase()] = value;
  }

  get(key: string) {
    return this.map[key.toLowerCase()] || null;
  }

  has(key: string) {
    return Object.hasOwn(this.map, key.toLowerCase());
  }

  delete(key: string) {
    delete this.map[key.toLowerCase()];
  }

  forEach(callback: (value: string, key: string) => void) {
    Object.keys(this.map).forEach((key) => void callback(this.map[key]!, key));
  }
}

class FormDataProxy {
  private _data: Record<string, any> = {};

  append(key: string, value: any) {
    this._data[key] = value;
  }

  getWrapperData() {
    return this._data;
  }
}

class ResponseProxy {
  ok: boolean;
  status: number;
  statusText: string;
  headers: HeadersProxy;
  url: string;
  private _data: any;

  constructor(wxRes: any) {
    this.status = wxRes.statusCode;
    this.ok = this.status >= 200 && this.status < 300;
    this.statusText = this.ok ? "OK" : "Error";
    this.headers = new HeadersProxy(wxRes.header || {});
    this.url = "";
    this._data = wxRes.data;
  }

  async json() {
    if (typeof this._data === "string") {
      try {
        return JSON.parse(this._data);
      } catch (_e) {
        return this._data;
      }
    }
    return this._data;
  }

  async text() {
    if (typeof this._data === "object") {
      return JSON.stringify(this._data);
    }
    return String(this._data);
  }

  clone() {
    return this;
  }
}

class FileProxy {}
class BlobProxy {}

export const fetchProxy = async (url: string, options: any = {}) => {
  return new Promise((resolve, reject) => {
    const method = (options.method || "GET").toUpperCase();

    let header: Record<string, string> = {};
    if (options.headers) {
      if (
        options.headers instanceof HeadersProxy ||
        typeof options.headers.forEach === "function"
      ) {
        options.headers.forEach((v: string, k: string) => {
          header[k] = v;
        });
      } else {
        header = options.headers;
      }
    }

    // 🔥 1. 注入 Cookie
    const cookieStr = getCookieHeaderString();
    if (cookieStr) {
      // 如果已有 Cookie，则追加（注意：如果 header 里原本就有 Cookie，可能需要合并，这里简单覆盖/追加）
      header.Cookie = cookieStr;
    }

    let data = options.body;
    if (data instanceof FormDataProxy) {
      data = data.getWrapperData();
    }

    wx.request({
      url,
      method: method as any,
      data,
      header,
      success: (res: any) => {
        // 🔥 2. 捕获 Set-Cookie
        // 微信 header 里的 key 可能是小写也可能是大写，需要兼容
        const setCookie = res.header["Set-Cookie"] || res.header["set-cookie"];
        if (setCookie) {
          updateCookies(setCookie);
        }

        resolve(new ResponseProxy(res));
      },
      fail: (err: any) => {
        reject(new TypeError(`Network request failed: ${err.errMsg}`));
      },
    });
  });
};

// 注入全局
if (!g.fetch) g.fetch = fetchProxy;
if (!g.Headers) g.Headers = HeadersProxy;
if (!g.Response) g.Response = ResponseProxy;
if (!g.FormData) g.FormData = FormDataProxy;
if (!g.File) g.File = FileProxy;
if (!g.Blob) g.Blob = BlobProxy;

export default fetchProxy;
