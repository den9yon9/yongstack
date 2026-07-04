import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import * as v from "valibot";
import { Breadcrumb } from "../../../components/Breadcrumb";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import {
  Table,
  TBody,
  TBodyRow,
  TD,
  TH,
  THead,
  THeadRow,
} from "../../../components/ui/Table";
import { api } from "../../../libs/api";

const productSearchSchema = v.object({
  page: v.optional(v.number()),
  keyword: v.pipe(
    v.optional(v.string()),
    v.transform((input) => (input === "" ? undefined : input)),
  ),
  status: v.pipe(
    v.optional(v.string()),
    v.transform((input) => (input === "" ? undefined : input)),
    v.optional(v.union([v.literal("online"), v.literal("offline")])),
  ),
  categoryId: v.pipe(
    v.optional(v.string()),
    v.transform((input) => (input === "" ? undefined : input)),
  ),
});

export const Route = createFileRoute("/_studio/products/")({
  staticData: { showInNav: false },
  validateSearch: productSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const { categoryId, ...rest } = deps;
    const result = await api.products.get({
      query: {
        ...rest,
        ...(categoryId ? { categoryId: Number(categoryId) } : {}),
      },
    });
    if (result.error) throw result.error;
    return result.data;
  },
  component: ProductsPage,
});

function ProductsPage() {
  const search = Route.useSearch();
  const data = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const router = useRouter();

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.categories.get();
      return (res.data ?? []) as {
        id: number;
        name: string;
        parentId: number | null;
      }[];
    },
  });

  const catMap = new Map(categories?.map((c) => [c.id, c.name]));

  async function handleDelete(id: number) {
    if (!confirm("确定删除该商品？")) return;
    const res = await api.products({ id }).delete();
    if (res.error) {
      toast.error("删除失败");
      return;
    }
    toast.success("已删除");
    router.invalidate();
  }

  async function handleToggle(id: number, current: "online" | "offline") {
    const next = current === "online" ? "offline" : "online";
    const res = await api.products({ id }).status.patch({ status: next });
    if (res.error) {
      toast.error("操作失败");
      return;
    }
    router.invalidate();
  }

  const statusOptions = [
    { value: "online", label: "上架", variant: "success" as const },
    { value: "offline", label: "下架", variant: "danger" as const },
  ];

  return (
    <div>
      <Breadcrumb>
        <Link to="/products/new">
          <Button size="sm">
            <Plus className="size-4" />
            新建
          </Button>
        </Link>
      </Breadcrumb>

      <div className="mb-5 rounded-lg border border-border bg-surface p-4 shadow-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            navigate({
              search: v.parse(productSearchSchema, {
                page: 1,
                ...Object.fromEntries(fd.entries()),
              }),
            });
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="relative min-w-0 flex-1 basis-48">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <input
              name="keyword"
              defaultValue={search.keyword ?? ""}
              placeholder="搜索商品名称..."
              className="block h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select
            name="status"
            defaultValue={search.status ?? ""}
            className="block h-9 min-w-0 flex-1 basis-32 rounded-lg border border-border bg-surface px-3 text-sm text-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">全部状态</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            name="categoryId"
            defaultValue={search.categoryId ?? ""}
            className="block h-9 min-w-0 flex-1 basis-32 rounded-lg border border-border bg-surface px-3 text-sm text-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">全部分类</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              <Search className="size-4" />
              筛选
            </Button>
            <Button
              type="reset"
              variant="secondary"
              size="sm"
              onClick={() => navigate({ search: {} })}
            >
              <RotateCcw className="size-4" />
              重置
            </Button>
          </div>
        </form>
      </div>

      <Table>
        <THead>
          <THeadRow>
            <TH>封面</TH>
            <TH>名称</TH>
            <TH>分类</TH>
            <TH>状态</TH>
            <TH>创建时间</TH>
            <TH className="text-right">操作</TH>
          </THeadRow>
        </THead>
        <TBody>
          {data.items.length === 0 ? (
            <TBodyRow>
              <TD colSpan={6} className="py-12 text-center text-text-muted">
                暂无商品
              </TD>
            </TBodyRow>
          ) : (
            data.items.map((p) => (
              <TBodyRow key={p.id}>
                <TD>
                  {p.coverUrl ? (
                    <img
                      src={p.coverUrl}
                      alt=""
                      className="size-10 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="size-10 rounded-lg border border-border bg-surface-hover" />
                  )}
                </TD>
                <TD className="font-medium">
                  <Link
                    to="/products/$id"
                    params={{ id: p.id.toString() }}
                    className="transition-colors hover:text-primary"
                  >
                    {p.name}
                  </Link>
                </TD>
                <TD className="text-text-secondary">
                  {p.categoryId ? (catMap.get(p.categoryId) ?? "—") : "—"}
                </TD>
                <TD>
                  <Badge variant={p.status === "online" ? "success" : "danger"}>
                    {p.status === "online" ? "上架" : "下架"}
                  </Badge>
                </TD>
                <TD className="text-text-secondary">
                  {new Date(p.createdAt).toLocaleDateString("zh-CN")}
                </TD>
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                    <Link to={"/products/$id"} params={{ id: p.id.toString() }}>
                      <Button variant="secondary" size="sm" aria-label="编辑">
                        <Pencil className="size-4 sm:mr-1" />
                        <span className="hidden sm:inline">编辑</span>
                      </Button>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggle(p.id, p.status)}
                      aria-label={p.status === "online" ? "下架" : "上架"}
                    >
                      {p.status === "online" ? (
                        <ArrowDownToLine className="size-4 sm:mr-1" />
                      ) : (
                        <ArrowUpFromLine className="size-4 sm:mr-1" />
                      )}
                      <span className="hidden sm:inline">
                        {p.status === "online" ? "下架" : "上架"}
                      </span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDelete(p.id)}
                      aria-label="删除"
                    >
                      <Trash2 className="size-4 sm:mr-1" />
                      <span className="hidden sm:inline">删除</span>
                    </Button>
                  </div>
                </TD>
              </TBodyRow>
            ))
          )}
        </TBody>
      </Table>

      <div className="mt-5 flex items-center justify-center gap-4">
        <Button
          variant="secondary"
          size="sm"
          disabled={data.page <= 1}
          onClick={() =>
            navigate({ search: (prev) => ({ ...prev, page: data.page - 1 }) })
          }
        >
          上一页
        </Button>
        <span className="text-sm text-text-secondary">
          第 {data.page} / {data.totalPage} 页
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={data.page >= data.totalPage}
          onClick={() =>
            navigate({ search: (prev) => ({ ...prev, page: data.page + 1 }) })
          }
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
