import { Link, useMatches } from "@tanstack/react-router";
import { ChevronRight, House } from "lucide-react";
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

  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <nav
        aria-label="面包屑导航"
        className="flex min-h-9 items-center gap-1 text-sm text-text-secondary"
      >
        <House className="size-4 shrink-0 text-text-muted" />
        <ChevronRight className="size-3.5 shrink-0 text-text-muted" />
        {crumbs.length === 0 ? (
          <span className="font-medium text-text">首页</span>
        ) : (
          crumbs.map((crumb, i) => (
            <div key={crumb.path ?? i} className="flex items-center gap-1">
              {crumb.path ? (
                <Link
                  to={crumb.path}
                  className="rounded px-1 py-0.5 transition-colors hover:bg-surface-hover hover:text-text"
                >
                  {crumb.title}
                </Link>
              ) : (
                <span className="rounded px-1 py-0.5 font-medium text-primary">
                  {crumb.title}
                </span>
              )}
              {i < crumbs.length - 1 && (
                <ChevronRight className="size-3.5 shrink-0 text-text-muted" />
              )}
            </div>
          ))
        )}
      </nav>
      {children && (
        <div className="flex shrink-0 items-center gap-3">{children}</div>
      )}
    </div>
  );
}
