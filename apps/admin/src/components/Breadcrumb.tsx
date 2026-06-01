import { Link, useMatches } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

export function Breadcrumb({ children }: Props) {
  const matches = useMatches();

  const crumbs = matches
    .filter((m, i, arr) => {
      if (m.routeId === "__root__") return false;
      if (i > 0 && m.pathname === arr[i - 1].pathname) return false;
      const data = (m as unknown as { staticData?: Record<string, unknown> })
        .staticData;
      if (!data?.title) return false;
      return true;
    })
    .map((m, i, arr) => {
      const data = (m as unknown as { staticData?: Record<string, unknown> })
        .staticData;
      return {
        title: data?.title as string,
        path: i < arr.length - 1 ? m.pathname : undefined,
      };
    });

  if (crumbs.length === 0 && !children) return null;

  const nav = (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500">
      {crumbs.length === 0 ? (
        <span className="font-medium text-gray-900">首页</span>
      ) : (
        crumbs.map((crumb, i) => (
          <span
            key={crumb.path ?? "last"}
            className="flex items-center gap-1.5"
          >
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
            {crumb.path ? (
              <Link
                to={crumb.path}
                className="hover:text-gray-900 transition-colors"
              >
                {crumb.title}
              </Link>
            ) : (
              <span className="font-medium text-gray-900">{crumb.title}</span>
            )}
          </span>
        ))
      )}
    </nav>
  );

  if (children) {
    return (
      <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-2">
        {nav}
        <div className="flex items-center gap-3">{children}</div>
      </div>
    );
  }

  return <div className="px-6 pt-4 pb-2">{nav}</div>;
}
