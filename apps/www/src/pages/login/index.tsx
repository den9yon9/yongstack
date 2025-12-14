import { useQueryClient } from "eden-preact-query";
import { useState } from "preact/hooks";
import { useLocation } from "wouter-preact";
import { api } from "@/lib/api";

export default function Login() {
  const [, setLocation] = useLocation();

  const queryClient = useQueryClient();

  // 模式切换：登录 / 注册
  const [isLoginMode, setIsLoginMode] = useState(true);

  // 表单状态
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      if (isLoginMode) {
        // --- 登录逻辑 ---
        const { error } = await api.auth.login.post({
          username,
          password,
        });

        if (error) {
          // 处理 API 返回的错误
          throw new Error(
            typeof error.value === "string"
              ? error.value
              : "登录失败，请检查用户名或密码",
          );
        }
      } else {
        // --- 注册逻辑 ---
        const { error } = await api.auth.register.post({
          username,
          password,
          nickname: `User_${username}`, // 默认昵称
        });

        if (error) {
          throw new Error(
            typeof error.value === "string"
              ? error.value
              : "注册失败，用户名可能已存在",
          );
        }
      }

      queryClient.clear();

      // 成功后跳转回首页
      setLocation("/");
    } catch (err: any) {
      setErrorMsg(err.message || "未知错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm shadow-2xl bg-base-100">
        <div className="card-body">
          <h2 className="card-title justify-center text-2xl font-bold mb-4">
            {isLoginMode ? "欢迎回来" : "创建账号"}
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 用户名输入 */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">用户名</span>
              </label>
              <input
                type="text"
                placeholder="admin"
                className="input input-bordered"
                value={username}
                onInput={(e) => setUsername(e.currentTarget.value)}
                required
                minLength={3}
              />
            </div>

            {/* 密码输入 */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">密码</span>
              </label>
              <input
                type="password"
                placeholder="******"
                className="input input-bordered"
                value={password}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                minLength={6}
              />
              <label className="label">
                <button
                  className="label-text-alt link link-hover text-gray-400"
                  onClick={(e) => {
                    e.preventDefault();
                    // 这里可以留给以后做忘记密码
                    alert("联系管理员重置密码");
                  }}
                >
                  忘记密码?
                </button>
              </label>
            </div>

            {/* 错误提示 */}
            {errorMsg && (
              <div className="alert alert-error text-sm py-2 rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 提交按钮 */}
            <div className="form-control mt-4">
              <button
                className={`btn btn-primary ${loading ? "loading" : ""}`}
                disabled={loading}
              >
                {loading && <span className="loading loading-spinner"></span>}
                {isLoginMode ? "登 录" : "注 册"}
              </button>
            </div>
          </form>

          {/* 切换模式 */}
          <div className="divider text-xs text-gray-400">OR</div>

          <div className="text-center text-sm">
            {isLoginMode ? "还没有账号？" : "已有账号？"}
            <button
              type="button"
              className="link link-primary ml-2 font-bold no-underline hover:underline"
              onClick={() => {
                setErrorMsg("");
                setIsLoginMode(!isLoginMode);
              }}
            >
              {isLoginMode ? "立即注册" : "去登录"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
