import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import * as v from "valibot";
import { Breadcrumb } from "../../../components/Breadcrumb";
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
    const result = await api.product.get({
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
      const res = await api.product.categories.get();
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
    const res = await api.product({ id }).delete();
    if (res.error) {
      toast.error("删除失败");
      return;
    }
    toast.success("已删除");
    router.invalidate();
  }

  async function handleToggle(id: number, current: "online" | "offline") {
    const next = current === "online" ? "offline" : "online";
    const res = await api.product({ id }).status.patch({ status: next });
    if (res.error) {
      toast.error("操作失败");
      return;
    }
    router.invalidate();
  }

  return (
    <div className="p-6">
      <Breadcrumb>
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
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              name="keyword"
              defaultValue={search.keyword ?? ""}
              placeholder="搜索..."
              className="w-40 h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
          <select
            name="status"
            defaultValue={search.status ?? ""}
            className="h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <option value="">全部状态</option>
            <option value="online">上架</option>
            <option value="offline">下架</option>
          </select>
          <select
            name="categoryId"
            defaultValue={search.categoryId ?? ""}
            className="h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <option value="">全部分类</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-9 px-4 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-all"
          >
            筛选
          </button>
          <button
            type="reset"
            onClick={() => navigate({ search: {} })}
            className="h-9 px-3 border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 text-sm font-medium rounded-lg transition-all"
          >
            重置
          </button>
        </form>
        <Link
          to="/products/new"
          className="flex items-center gap-1.5 h-9 px-4 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-all"
        >
          <Plus className="w-4 h-4" /> 新建
        </Link>
      </Breadcrumb>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                封面
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                名称
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                分类
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                状态
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                创建时间
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  暂无商品
                </td>
              </tr>
            ) : (
              data.items.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50"
                >
                  <td className="px-4 py-3">
                    {p.coverUrl ? (
                      <img
                        src={p.coverUrl}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover bg-gray-100"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to="/products/$id"
                      params={{ id: p.id.toString() }}
                      className="text-gray-900 hover:text-gray-600"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {p.categoryId ? (catMap.get(p.categoryId) ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        p.status === "online"
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {p.status === "online" ? "上架" : "下架"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(p.createdAt).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={"/products/$id"}
                        params={{ id: p.id.toString() }}
                        className="text-xs text-gray-500 hover:text-gray-900"
                      >
                        编辑
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleToggle(p.id, p.status)}
                        className="text-xs text-gray-500 hover:text-gray-900"
                      >
                        {p.status === "online" ? "下架" : "上架"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-2 mt-4">
        <button
          type="button"
          disabled={data.page <= 1}
          onClick={() =>
            navigate({ search: (prev) => ({ ...prev, page: data.page - 1 }) })
          }
          className="h-8 px-3 rounded-lg text-sm border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
        >
          上一页
        </button>
        <span className="text-sm text-gray-500">
          {data.page} / {data.totalPage}
        </span>
        <button
          type="button"
          disabled={data.page >= data.totalPage}
          onClick={() =>
            navigate({ search: (prev) => ({ ...prev, page: data.page + 1 }) })
          }
          className="h-8 px-3 rounded-lg text-sm border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
