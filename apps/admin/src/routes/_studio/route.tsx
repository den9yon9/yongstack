import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useRouter,
} from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  LayoutDashboard,
  type LucideIcon,
  Package,
} from "lucide-react";
import { useState } from "react";
import { ThemeSwitcher } from "../../components/ThemeSwitcher";

export const Route = createFileRoute("/_studio")({
  staticData: { title: "Studio" },
  component: StudioLayout,
});

function StudioLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-base-200">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

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

const iconRegistry: Record<string, LucideIcon> = {
  LayoutDashboard,
  Package,
  FolderTree,
};

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
  const IconComp = item.icon ? iconRegistry[item.icon] : null;
  return (
    <Link
      to={item.path}
      className={`flex items-center gap-3 rounded-btn px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-base-200 font-medium text-base-content"
          : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
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
  const IconComp = section.icon ? iconRegistry[section.icon] : null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-btn px-3 py-2 text-sm transition-colors ${
          active || childActive
            ? "font-medium text-base-content"
            : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
        }`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        {IconComp && <IconComp className="h-4 w-4 shrink-0" />}
        <span className="flex-1 text-left">{section.title}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-base-content/40" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-base-content/40" />
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
    <aside className="flex h-full w-64 flex-col border-r border-base-300 bg-base-100">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-base-300 px-6">
        <div className="bg-primary text-primary-content flex h-8 w-8 items-center justify-center rounded-btn text-sm font-bold">
          Y
        </div>
        <span className="text-sm font-semibold text-base-content">
          YongStack
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {navItems.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-base-content/40">
            暂无导航
          </p>
        )}
        {navItems.map((item) => entryToNavItem(item, pathname, 0))}
      </nav>
      <div className="border-t border-base-300 p-3">
        <ThemeSwitcher />
      </div>
    </aside>
  );
}
