import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { minLength, object, parse, pipe, string } from "valibot";
import { api } from "../libs/api";

const loginSchema = object({
  username: pipe(string(), minLength(1, "用户名不能为空")),
  password: pipe(string(), minLength(6, "密码至少6个字符")),
});

export const Route = createFileRoute("/signin")({
  component: RouteComponent,
});

function RouteComponent() {
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const rawData = {
      username: formData.get("username") as string,
      password: formData.get("password") as string,
    };

    const data = parse(loginSchema, rawData);
    const res = await api.POST("/auth/login", { body: data });
    if (res.error) throw res.error;
    toast.success("登录成功");
    router.navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--lagoon-light)] to-[var(--lagoon-deep)] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-[var(--sea-ink)]">欢迎回来</h1>
          <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
            请输入您的账号和密码登录
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-sm font-medium text-[var(--sea-ink)]"
            >
              用户名
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[var(--lagoon-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon-light)]"
              placeholder="请输入用户名"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-[var(--sea-ink)]"
            >
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[var(--lagoon-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon-light)]"
              placeholder="请输入密码"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--lagoon-deep)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--sea-ink)]"
          >
            登录
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--sea-ink-soft)]">
          还没有账号？{" "}
          <a
            href="/signup"
            className="font-semibold text-[var(--lagoon-deep)] hover:underline"
          >
            立即注册
          </a>
        </div>
      </div>
    </div>
  );
}
