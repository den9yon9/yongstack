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
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-lg">
          <LogIn className="h-5 w-5 shrink-0 text-gray-400" />
          <div className="text-sm">
            <p className="text-gray-500">未登录</p>
            <Link
              to="/signin"
              replace
              className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-600"
            >
              去登录
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
