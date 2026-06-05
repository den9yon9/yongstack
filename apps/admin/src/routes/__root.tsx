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
import { api } from "../libs/api";

export const Route = createRootRoute({
  staticData: { title: "Root" },
  component: Component,
});

function Component() {
  const { error } = useQuery(api.user.mine.get.queryOptions());
  const isAuthError = error instanceof EdenFetchError && error.status === 401;
  const matchSigninRoute = useMatch({ from: "/signin", shouldThrow: false });

  return (
    <>
      <Outlet />
      {isAuthError && !matchSigninRoute && (
        <div className="fixed bottom-6 right-6 z-50 card card-border bg-base-100 shadow-lg px-0 py-0">
          <div className="card-body p-4">
            <div className="flex items-center gap-3">
              <LogIn className="h-5 w-5 shrink-0 text-base-content/40" />
              <div className="text-sm">
                <p className="text-base-content/60">未登录</p>
                <Link
                  to="/signin"
                  replace
                  className="link link-primary font-medium"
                >
                  去登录
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
