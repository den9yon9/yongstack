import { Link, useMatches } from "@tanstack/react-router";
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

  return (
    <div className="navbar min-h-0 p-3 rounded-lg mb-1 bg-base-100 border-b border-base-300">
      <div className="navbar-start">
        <div className="breadcrumbs text-sm">
          <ul>
            {crumbs.length === 0 ? (
              <li>
                <span className="font-medium text-base-content">首页</span>
              </li>
            ) : (
              crumbs.map((crumb, i) => (
                <li key={crumb.path ?? i}>
                  {crumb.path ? (
                    <Link
                      to={crumb.path}
                      className="link link-hover text-base-content/60"
                    >
                      {crumb.title}
                    </Link>
                  ) : (
                    <span className="font-medium text-base-content">
                      {crumb.title}
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      {children && <div className="navbar-end grow gap-2">{children}</div>}
    </div>
  );
}
