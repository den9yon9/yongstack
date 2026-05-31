import { Link, useLocation, useRouter } from "@tanstack/react-router";
import * as icons from "lucide-react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface FlatNavItem {
  title: string;
  icon: string | undefined;
  path: string;
  order: number;
}

interface NavSection extends FlatNavItem {
  children: (FlatNavItem | NavSection)[];
}

type NavEntry = FlatNavItem | NavSection;

function isActive(path: string, pathname: string) {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(path + "/");
}

function hasActiveChild(entry: NavEntry, pathname: string): boolean {
  if ("children" in entry) {
    return entry.children.some(
      (c) => isActive(c.path, pathname) || hasActiveChild(c, pathname),
    );
  }
  return false;
}

function entryToNavItem(
  entry: NavEntry,
  pathname: string,
  level: number,
): React.ReactNode {
  if ("children" in entry) {
    return (
      <SectionItem
        key={entry.path}
        section={entry}
        pathname={pathname}
        level={level}
      />
    );
  }
  return (
    <LeafItem key={entry.path} item={entry} pathname={pathname} level={level} />
  );
}

function LeafItem({
  item,
  pathname,
  level,
}: {
  item: FlatNavItem;
  pathname: string;
  level: number;
}) {
  const active = isActive(item.path, pathname);
  // biome-ignore lint/suspicious/noExplicitAny: dynamic lucide icon lookup
  const IconComp = item.icon ? (icons as any)[item.icon] : null;
  return (
    <Link
      to={item.path}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-gray-100 font-medium text-gray-900"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
      style={{ paddingLeft: `${12 + level * 16}px` }}
    >
      {IconComp && <IconComp className="h-4 w-4 shrink-0" />}
      <span>{item.title}</span>
    </Link>
  );
}

function SectionItem({
  section,
  pathname,
  level,
}: {
  section: NavSection;
  pathname: string;
  level: number;
}) {
  const active = isActive(section.path, pathname);
  const childActive = hasActiveChild(section, pathname);
  const [expanded, setExpanded] = useState(active || childActive);
  // biome-ignore lint/suspicious/noExplicitAny: dynamic lucide icon lookup
  const IconComp = section.icon ? (icons as any)[section.icon] : null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          active || childActive
            ? "font-medium text-gray-900"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        {IconComp && <IconComp className="h-4 w-4 shrink-0" />}
        <span className="flex-1 text-left">{section.title}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>
      {expanded && (
        <div className="mt-0.5">
          {section.children.map((child) =>
            entryToNavItem(child, pathname, level + 1),
          )}
        </div>
      )}
    </div>
  );
}

type RouteLike = {
  id: string;
  path?: string;
  isRoot?: boolean;
  options: { staticData?: Record<string, unknown> };
  children?: RouteLike[];
};

function collect(route: RouteLike): NavEntry[] {
  if (route.isRoot)
    return route.children ? route.children.flatMap(collect) : [];

  const data = route.options?.staticData;
  if (data?.showInNav === false) return [];

  const children: NavEntry[] = [];
  if (route.children) {
    for (const child of route.children) {
      children.push(...collect(child));
    }
  }
  children.sort((a, b) => a.order - b.order);

  if (!route.path) return children;

  const entry: FlatNavItem = {
    title: (data?.title as string) ?? route.id,
    icon: data?.icon as string | undefined,
    path: route.path.startsWith("/") ? route.path : "/" + route.path,
    order: (data?.order as number) ?? 99,
  };

  if (children.length > 0) {
    return [{ ...entry, children }];
  }

  return [entry];
}

export function Sidebar() {
  const router = useRouter();
  const { pathname } = useLocation();
  const routeTree = router.routeTree as unknown as RouteLike;
  const navItems = collect(routeTree);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-gray-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-sm font-bold text-white">
          Y
        </div>
        <span className="text-sm font-semibold text-gray-900">YongStack</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {navItems.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-gray-400">
            暂无导航
          </p>
        )}
        {navItems.map((item) => entryToNavItem(item, pathname, 0))}
      </nav>
    </aside>
  );
}
