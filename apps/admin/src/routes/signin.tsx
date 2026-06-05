import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, LogIn, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as v from "valibot";
import { api } from "../libs/api";
import { queryClient } from "../libs/queryClient";

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
  staticData: { title: "登录", showInNav: false },
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"password" | "phone">("password");

  const router = useRouter();

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
      const res = await api.auth.phone.code.post({ phone });
      if (res.error) {
        if (res.error.status === 429) {
          startCountdown(res.error.value.remainingSeconds);
          return;
        }
        toast.error("发送失败", {
          description:
            typeof res.error.value === "string"
              ? res.error.value
              : "请稍后重试",
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
        const { error } = await api.auth.login.post({
          username,
          password,
        });
        if (error) {
          toast.error("登录失败", {
            description: typeof error === "string" ? error : "用户名或密码错误",
          });
          return;
        }
        toast.success("登录成功");
        router.invalidate();
        queryClient.invalidateQueries();
        navigate({ to: "/dashboard" });
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
        const { error } = await api.auth.phone.login.post({
          phone,
          code,
        });
        if (error) {
          toast.error("登录失败", {
            description:
              typeof error === "string" ? error : "验证码错误或已过期",
          });
          return;
        }
        toast.success("登录成功");
        router.invalidate();
        queryClient.invalidateQueries();
        navigate({ to: "/dashboard" });
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
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="w-full max-w-sm">
        <div className="card bg-base-100 card-border">
          <form onSubmit={handleSubmit} className="card-body gap-6">
            <div className="text-center">
              <div className="bg-primary text-primary-content w-12 h-12 rounded-btn flex items-center justify-center mx-auto mb-4">
                <LogIn className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-semibold text-base-content">
                欢迎回来
              </h1>
              <p className="text-sm text-base-content/60 mt-1">
                请登录你的账号
              </p>
            </div>

            <div className="tabs tabs-bordered">
              <button
                type="button"
                onClick={() => switchMode("password")}
                className={`tab gap-2 ${mode === "password" ? "tab-active" : ""}`}
              >
                <KeyRound className="w-4 h-4" />
                密码登录
              </button>
              <button
                type="button"
                onClick={() => switchMode("phone")}
                className={`tab gap-2 ${mode === "phone" ? "tab-active" : ""}`}
              >
                <Smartphone className="w-4 h-4" />
                手机登录
              </button>
            </div>

            {mode === "password" && (
              <div className="space-y-4">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text">用户名</span>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="输入用户名"
                    className="input input-bordered w-full"
                  />
                  {errors.username && (
                    <div className="label">
                      <span className="label-text-alt text-error">
                        {errors.username}
                      </span>
                    </div>
                  )}
                </label>
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text">密码</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="输入密码"
                      className="input input-bordered w-full pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content transition-colors"
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
                    <div className="label">
                      <span className="label-text-alt text-error">
                        {errors.password}
                      </span>
                    </div>
                  )}
                </label>
              </div>
            )}

            {mode === "phone" && (
              <div className="space-y-4">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text">手机号</span>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="输入手机号"
                    maxLength={11}
                    className="input input-bordered w-full"
                  />
                  {errors.phone && (
                    <div className="label">
                      <span className="label-text-alt text-error">
                        {errors.phone}
                      </span>
                    </div>
                  )}
                </label>
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text">验证码</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="输入验证码"
                      maxLength={6}
                      className="input input-bordered flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={smsLoading || smsCountdown > 0}
                      className="btn btn-primary"
                    >
                      {smsLoading ? (
                        <span className="loading loading-spinner loading-sm" />
                      ) : smsCountdown > 0 ? (
                        `${smsCountdown}s`
                      ) : (
                        "发送验证码"
                      )}
                    </button>
                  </div>
                  {errors.code && (
                    <div className="label">
                      <span className="label-text-alt text-error">
                        {errors.code}
                      </span>
                    </div>
                  )}
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? <span className="loading loading-spinner" /> : "登录"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
