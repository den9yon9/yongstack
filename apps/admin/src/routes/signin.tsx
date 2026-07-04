import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
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
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
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
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-card">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white">
            Y
          </div>
          <h1 className="text-xl font-semibold text-text">欢迎回来</h1>
          <p className="mt-1 text-sm text-text-secondary">请登录你的账号</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => switchMode("password")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-colors ${
                mode === "password"
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border text-text-secondary hover:bg-surface-hover"
              }`}
            >
              <KeyRound className="size-4" />
              密码登录
            </button>
            <button
              type="button"
              onClick={() => switchMode("phone")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-colors ${
                mode === "phone"
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border text-text-secondary hover:bg-surface-hover"
              }`}
            >
              <Smartphone className="size-4" />
              手机登录
            </button>
          </div>

          {mode === "password" && (
            <div className="space-y-4">
              <Input
                label="用户名"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="输入用户名"
                error={errors.username}
              />
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-text"
                >
                  密码
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.password;
                        return next;
                      });
                    }}
                    placeholder="输入密码"
                    className={`block h-9 w-full rounded-lg border bg-surface pr-10 pl-3 text-sm text-text placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 ${
                      errors.password
                        ? "border-danger focus:ring-danger/50"
                        : "border-border focus:ring-primary/50"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                    tabIndex={-1}
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-danger" role="alert">
                    {errors.password}
                  </p>
                )}
              </div>
            </div>
          )}

          {mode === "phone" && (
            <div className="space-y-4">
              <Input
                label="手机号"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, ""));
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.phone;
                    return next;
                  });
                }}
                placeholder="输入手机号"
                maxLength={11}
                error={errors.phone}
              />
              <div className="space-y-1.5">
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-text"
                >
                  验证码
                </label>
                <div className="flex gap-2">
                  <input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, ""));
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.code;
                        return next;
                      });
                    }}
                    placeholder="输入验证码"
                    maxLength={6}
                    className={`block h-9 flex-1 rounded-lg border bg-surface px-3 text-sm text-text placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 ${
                      errors.code
                        ? "border-danger focus:ring-danger/50"
                        : "border-border focus:ring-primary/50"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={smsLoading || smsCountdown > 0}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text disabled:pointer-events-none disabled:opacity-50"
                  >
                    {smsLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : smsCountdown > 0 ? (
                      `${smsCountdown}s`
                    ) : (
                      "发送验证码"
                    )}
                  </button>
                </div>
                {errors.code && (
                  <p className="text-xs text-danger" role="alert">
                    {errors.code}
                  </p>
                )}
              </div>
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full">
            {loading ? null : <LogIn className="size-4" />}
            登录
          </Button>
        </form>
      </div>
    </div>
  );
}
