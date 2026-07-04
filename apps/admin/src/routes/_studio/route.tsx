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
  Menu,
  Package,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeSwitcher } from "../../components/ThemeSwitcher";

export const Route = createFileRoute("/_studio")({
  staticData: { title: "Studio" },
  component: StudioLayout,
});

function StudioLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 bg-bg md:pl-60">
        <div className="mx-auto max-w-6xl p-4 sm:p-6">
          <div className="mb-4 md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex size-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
              aria-label="打开导航菜单"
            >
              <Menu className="size-5" />
            </button>
          </div>
          <Outlet />
        </div>
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
  return pathname === path || pathname.startsWith(`${path}/`);
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
  onClose?: () => void,
): React.ReactNode {
  if ("children" in entry) {
    return (
      <SectionItem
        key={entry.path}
        section={entry}
        pathname={pathname}
        level={level}
        onClose={onClose}
      />
    );
  }
  return (
    <LeafItem key={entry.path} item={entry} level={level} onClose={onClose} />
  );
}

const iconRegistry: Record<string, LucideIcon> = {
  LayoutDashboard,
  Package,
  FolderTree,
};

function LeafItem({
  item,
  level,
  onClose,
}: {
  item: FlatNavItem;
  level: number;
  onClose?: () => void;
}) {
  const { pathname } = useLocation();
  const active = isActive(item.path, pathname);
  const IconComp = item.icon ? iconRegistry[item.icon] : null;

  return (
    <Link
      to={item.path}
      onClick={onClose}
      data-active={active || undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-sidebar-active text-white"
          : "text-on-sidebar-muted hover:bg-sidebar-hover hover:text-on-sidebar"
      }`}
      style={{ paddingLeft: `${12 + level * 16}px` }}
    >
      {IconComp && <IconComp className="size-5 shrink-0" />}
      <span>{item.title}</span>
    </Link>
  );
}

function SectionItem({
  section,
  pathname,
  level,
  onClose,
}: {
  section: NavSection;
  pathname: string;
  level: number;
  onClose?: () => void;
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
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active || childActive
            ? "bg-sidebar-active text-white"
            : "text-on-sidebar-muted hover:bg-sidebar-hover hover:text-on-sidebar"
        }`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        <div className="flex items-center gap-3">
          {IconComp && <IconComp className="size-5 shrink-0" />}
          <span>{section.title}</span>
        </div>
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 opacity-70" />
        ) : (
          <ChevronRight className="size-4 shrink-0 opacity-70" />
        )}
      </button>
      {expanded && (
        <div className="mt-1 space-y-1">
          {section.children.map((child) =>
            entryToNavItem(child, pathname, level + 1, onClose),
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
    path: route.path.startsWith("/") ? route.path : `/${route.path}`,
    order: (data?.order as number) ?? 99,
  };

  if (children.length > 0) {
    return [{ ...entry, children }];
  }

  return [entry];
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const routeTree = router.routeTree as unknown as RouteLike;
  const navItems = collect(routeTree);

  return (
    <>
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-sidebar-hover px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-active text-sm font-bold text-on-sidebar">
            Y
          </div>
          <span className="text-base font-semibold text-on-sidebar">
            YongStack
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-on-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-on-sidebar"
            aria-label="关闭导航菜单"
          >
            <X className="size-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navItems.length === 0 && (
          <p className="px-3 text-sm text-on-sidebar-muted">暂无导航</p>
        )}
        <div className="space-y-1">
          {navItems.map((item) => entryToNavItem(item, "", 0, onClose))}
        </div>
      </nav>
      <div className="shrink-0 border-t border-sidebar-hover px-3 py-3">
        <ThemeSwitcher />
      </div>
    </>
  );
}

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex">
        <aside className="flex w-60 flex-col bg-sidebar">
          <SidebarContent />
        </aside>
      </div>

      {/* Mobile */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${
          open ? "" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={onClose}
        />
        <aside
          className={`absolute left-0 top-0 z-10 flex h-full w-60 flex-col bg-sidebar shadow-dropdown transition-transform duration-200 ease-in-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarContent onClose={onClose} />
        </aside>
      </div>
    </>
  );
}
