import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Package, Tags, TrendingUp, XCircle } from "lucide-react";
import { Breadcrumb } from "../../components/Breadcrumb";
import { Card, CardHeader } from "../../components/ui/Card";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { api } from "../../libs/api";

export const Route = createFileRoute("/_studio/dashboard")({
  staticData: { title: "仪表盘", icon: "LayoutDashboard", order: 0 },
  component: Dashboard,
});

const statCards = [
  { key: "total", label: "总商品数", icon: Package, variant: "info" as const },
  {
    key: "online",
    label: "上架商品",
    icon: TrendingUp,
    variant: "success" as const,
  },
  {
    key: "offline",
    label: "下架商品",
    icon: XCircle,
    variant: "danger" as const,
  },
  {
    key: "categories",
    label: "类目数",
    icon: Tags,
    variant: "warning" as const,
  },
];

const iconStyles: Record<string, string> = {
  info: "bg-primary text-white",
  success: "bg-success text-white",
  danger: "bg-danger text-white",
  warning: "bg-warning text-white",
};

function Dashboard() {
  const { data: totalProducts, isLoading: loadingProducts } = useQuery({
    queryKey: ["dashboard", "products"],
    queryFn: async () => {
      const res = await api.products.get({ query: { page: 1, pageSize: 1 } });
      if (res.error) throw res.error;
      return res.data;
    },
  });

  const { data: onlineProducts } = useQuery({
    queryKey: ["dashboard", "products", "online"],
    queryFn: async () => {
      const res = await api.products.get({
        query: { page: 1, pageSize: 1, status: "online" },
      });
      if (res.error) throw res.error;
      return res.data;
    },
  });

  const { data: offlineProducts } = useQuery({
    queryKey: ["dashboard", "products", "offline"],
    queryFn: async () => {
      const res = await api.products.get({
        query: { page: 1, pageSize: 1, status: "offline" },
      });
      if (res.error) throw res.error;
      return res.data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["dashboard", "categories"],
    queryFn: async () => {
      const res = await api.categories.get();
      if (res.error) throw res.error;
      return res.data ?? [];
    },
  });

  const stats: Record<string, number | null> = {
    total: totalProducts?.total ?? null,
    online: onlineProducts?.total ?? null,
    offline: offlineProducts?.total ?? null,
    categories: categories?.length ?? null,
  };

  const loading = loadingProducts;

  return (
    <div>
      <Breadcrumb />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ key, label, icon: Icon, variant }) => (
          <Card key={key}>
            {loading ? (
              <CardSkeleton />
            ) : (
              <div className="flex items-center gap-4">
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${iconStyles[variant]}`}
                >
                  <Icon className="size-6" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">{label}</p>
                  <p className="text-2xl font-bold text-text">
                    {stats[key] !== null ? stats[key] : "--"}
                  </p>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="快速操作" />
          <div className="flex flex-wrap gap-3">
            <a
              href="/products/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <Package className="size-4" />
              新建商品
            </a>
            <a
              href="/categories"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-hover"
            >
              <Tags className="size-4" />
              管理类目
            </a>
          </div>
        </Card>
        <Card>
          <CardHeader title="系统信息" />
          <div className="space-y-2 text-sm text-text-secondary">
            <div className="flex justify-between">
              <span>框架版本</span>
              <span className="font-medium text-text">React 19 + Elysia</span>
            </div>
            <div className="flex justify-between">
              <span>数据库</span>
              <span className="font-medium text-text">PostgreSQL</span>
            </div>
            <div className="flex justify-between">
              <span>运行环境</span>
              <span className="font-medium text-text">Bun</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
