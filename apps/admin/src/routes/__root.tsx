import "../styles.css";
import { EdenFetchError } from "@elysiajs/eden";
import { useQuery } from "@tanstack/react-query";
import {
  createRootRoute,
  Link,
  Outlet,
  useMatch,
} from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useEffect } from "react";
import { api } from "../libs/api";

const STORAGE_KEY = "theme";

function applyStoredTheme() {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark") {
    document.documentElement.classList.add("dark");
  } else if (stored === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    if (prefersDark) {
      document.documentElement.classList.add("dark");
    }
  }
}

export const Route = createRootRoute({
  staticData: { title: "Root" },
  component: Component,
});

function Component() {
  useEffect(() => {
    applyStoredTheme();
  }, []);

  const { error } = useQuery(api.user.mine.get.queryOptions());
  const isAuthError = error instanceof EdenFetchError && error.status === 401;
  const matchSigninRoute = useMatch({ from: "/signin", shouldThrow: false });

  return (
    <>
      <Outlet />
      {isAuthError && !matchSigninRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/60">
          <div className="rounded-xl bg-surface p-8 shadow-dropdown text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-danger-soft">
              <LogIn className="size-6 text-danger" />
            </div>
            <p className="mb-1 text-lg font-semibold text-text">未登录</p>
            <p className="mb-6 text-sm text-text-secondary">请先登录以继续</p>
            <Link
              to="/signin"
              replace
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <LogIn className="size-4" />
              去登录
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
