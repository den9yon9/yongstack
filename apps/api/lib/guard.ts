import type Elysia from "elysia";

// 这个插件用于从 Cookie 中解析 userId
export const isAuthenticated = (app: Elysia) =>
  app.derive(({ cookie: { userId }, status }) => {
    if (!userId.value) {
      throw status(401, "Unauthorized: 请先登录");
    }
    return {
      userId: Number(userId.value), // 将 userId 转换为数字供后续使用
    };
  });
