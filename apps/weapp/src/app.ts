import { api } from "./lib/api";

App({
  globalData: {},
  onLaunch() {
    wx.login({
      success({ code }) {
        api.auth.wechat.login.post({
          code,
        });
      },
    });
  },
  /**
   * 🔥 1. 捕获未处理的 Promise 拒绝 (API 错误通常走这里)
   * 当您在 Page 里 throw error 时，这里会收到
   */
  onUnhandledRejection(msg) {
    console.error("全局捕获 Promise 异常:", msg);

    // msg.reason 通常包含错误对象
    const reason = msg.reason as unknown;

    // 提取错误信息
    let errorMessage = "未知错误";
    if (reason instanceof Error) {
      errorMessage = reason.message;
    } else if (typeof reason === "string") {
      errorMessage = reason;
    } else if (
      reason &&
      typeof reason === "object" &&
      (reason as any).message
    ) {
      // 兼容 Elysia 或其他库返回的对象
      errorMessage = (reason as any).message;
    }

    // 统一弹窗提示
    wx.showToast({
      title: errorMessage,
      icon: "none",
      duration: 3000,
    });
  },

  /**
   * 🔥 2. 捕获脚本运行错误 (JS 语法错误或 throw Error)
   */
  onError(msg) {
    console.error("全局捕获脚本错误:", msg);
    // 这里通常用于上报日志到监控平台 (如 Sentry)
    // 不建议在这里弹窗，因为可能会频繁打断用户
  },
});
