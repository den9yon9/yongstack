import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  Smartphone,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as v from "valibot";
import { api } from "../libs/api";

const PasswordSchema = v.object({
  username: v.pipe(
    v.string(),
    v.minLength(1, "请输入用户名"),
    v.maxLength(50, "用户名最多50位"),
  ),
  password: v.pipe(
    v.string(),
    v.minLength(1, "请输入密码"),
    v.minLength(6, "密码至少6位"),
  ),
});

const PhoneSchema = v.object({
  phone: v.pipe(v.string(), v.regex(/^1[3-9]\d{9}$/, "手机号格式不正确")),
  code: v.pipe(
    v.string(),
    v.minLength(4, "请输入验证码"),
    v.maxLength(6, "验证码最多6位"),
  ),
});

export const Route = createFileRoute("/signin")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"password" | "phone">("password");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [smsCountdown, setSmsCountdown] = useState(0);
  const [smsLoading, setSmsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const startCountdown = (seconds: number) => {
    clearInterval(timerRef.current);
    setSmsCountdown(seconds);
    timerRef.current = setInterval(() => {
      setSmsCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    const result = v.safeParse(
      v.pipe(v.string(), v.regex(/^1[3-9]\d{9}$/, "手机号格式不正确")),
      phone,
    );
    if (!result.success) {
      setErrors({ phone: result.issues[0].message });
      return;
    }
    setErrors({});
    setSmsLoading(true);
    try {
      const res = await api.POST("/auth/phone/code", { body: { phone } });
      if (res.response.status === 429) {
        const remaining =
          (res.error as { remainingSeconds?: number })?.remainingSeconds ?? 60;
        startCountdown(remaining);
        return;
      }
      if (res.error) {
        toast.error("发送失败", {
          description: typeof res.error === "string" ? res.error : "请稍后重试",
        });
        return;
      }
      startCountdown(60);
      toast.success("验证码已发送");
    } catch (err) {
      toast.error("发送失败", {
        description: err instanceof Error ? err.message : "网络错误",
      });
    } finally {
      setSmsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (mode === "password") {
      const result = v.safeParse(PasswordSchema, { username, password });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of result.issues) {
          const key = issue.path?.[0]?.key as string;
          if (key) fieldErrors[key] = issue.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setLoading(true);
      try {
        const { error } = await api.POST("/auth/login", {
          body: { username, password },
        });
        if (error) {
          toast.error("登录失败", {
            description: typeof error === "string" ? error : "用户名或密码错误",
          });
          return;
        }
        toast.success("登录成功");
        navigate({ to: "/" });
      } catch (err) {
        toast.error("登录失败", {
          description: err instanceof Error ? err.message : "网络错误，请重试",
        });
      } finally {
        setLoading(false);
      }
    } else {
      const result = v.safeParse(PhoneSchema, { phone, code });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of result.issues) {
          const key = issue.path?.[0]?.key as string;
          if (key) fieldErrors[key] = issue.message;
        }
        setErrors(fieldErrors);
        return;
      }

      setLoading(true);
      try {
        const { error } = await api.POST("/auth/phone/login", {
          body: { phone, code },
        });
        if (error) {
          toast.error("登录失败", {
            description:
              typeof error === "string" ? error : "验证码错误或已过期",
          });
          return;
        }
        toast.success("登录成功");
        navigate({ to: "/" });
      } catch (err) {
        toast.error("登录失败", {
          description: err instanceof Error ? err.message : "网络错误，请重试",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const switchMode = (newMode: "password" | "phone") => {
    setMode(newMode);
    setErrors({});
    clearInterval(timerRef.current);
    setSmsCountdown(0);
    setCode("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6"
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">欢迎回来</h1>
            <p className="text-sm text-gray-500 mt-1">请登录你的账号</p>
          </div>

          <div className="flex border-b border-gray-100">
            <button
              type="button"
              onClick={() => switchMode("password")}
              className={`flex-1 pb-3 flex items-center justify-center gap-2 text-sm font-medium border-b-2 transition-colors ${
                mode === "password"
                  ? "text-gray-900 border-gray-900"
                  : "text-gray-400 border-transparent"
              }`}
            >
              <KeyRound className="w-4 h-4" />
              密码登录
            </button>
            <button
              type="button"
              onClick={() => switchMode("phone")}
              className={`flex-1 pb-3 flex items-center justify-center gap-2 text-sm font-medium border-b-2 transition-colors ${
                mode === "phone"
                  ? "text-gray-900 border-gray-900"
                  : "text-gray-400 border-transparent"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              手机登录
            </button>
          </div>

          {mode === "password" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="输入用户名"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-colors"
                />
                {errors.username && (
                  <p className="text-xs text-red-500 mt-1">{errors.username}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入密码"
                    className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-colors pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password}</p>
                )}
              </div>
            </div>
          )}

          {mode === "phone" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  手机号
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="输入手机号"
                  maxLength={11}
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-colors"
                />
                {errors.phone && (
                  <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  验证码
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="输入验证码"
                    maxLength={6}
                    className="flex-1 h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={smsLoading || smsCountdown > 0}
                    className="h-11 px-5 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 disabled:cursor-not-allowed bg-gray-900 hover:bg-gray-800 disabled:bg-gray-100 text-white disabled:text-gray-400"
                  >
                    {smsLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : smsCountdown > 0 ? (
                      `${smsCountdown}s`
                    ) : (
                      "发送验证码"
                    )}
                  </button>
                </div>
                {errors.code && (
                  <p className="text-xs text-red-500 mt-1">{errors.code}</p>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 flex items-center justify-center bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white text-sm font-medium rounded-xl transition-all active:scale-[0.98] disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
