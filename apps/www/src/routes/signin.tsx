import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { minLength, object, parse, pipe, string } from "valibot";
import { api } from "../libs/api";

const loginSchema = object({
  username: pipe(string(), minLength(1, "请输入用户名")),
  password: pipe(string(), minLength(6, "密码至少6位")),
});

export const Route = createFileRoute("/signin")({
  component: RouteComponent,
});

function RouteComponent() {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const data = parse(loginSchema, {
        username: account.trim(),
        password,
      });

      const res = await api.POST("/auth/login", { body: data });
      if (res.error) throw res.error;

      toast.success("登录成功", { description: "欢迎回来" });
      router.navigate({ to: "/" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-[24px] font-semibold text-gray-900 tracking-tight">
            Welcome back
          </h1>
          <p className="text-[14px] text-gray-500 mt-2">
            Sign in to your account to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* 账号输入框 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5 ml-1">
              Username
            </label>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="Enter your username"
              required
              disabled={isLoading}
              className="w-full h-12 px-4 bg-white border border-gray-200 rounded-2xl text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all disabled:opacity-60"
            />
          </div>

          {/* 密码输入框 */}
          <div>
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5 ml-1 flex justify-between">
              <span>Password</span>
              <a
                href="#"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                Forgot?
              </a>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
              className="w-full h-12 px-4 bg-white border border-gray-200 rounded-2xl text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all disabled:opacity-60"
            />
          </div>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={isLoading || !account || !password}
            className="mt-4 w-full h-12 flex items-center justify-center bg-gray-900 text-white text-[15px] font-medium rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? (
              <svg
                className="animate-spin h-5 w-5 text-white/70"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-8 text-center text-[13px] text-gray-500">
          Don't have an account?{" "}
          <a href="#" className="font-medium text-gray-900 hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
