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
});

export const Route = createFileRoute("/_studio/products/")({
  staticData: { showInNav: false },
  validateSearch: productSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const result = await api.product.get({ query: deps });
    if (result.error) throw result.error;
    return result.data;
  },
  component: ProductsPage,
});

function ProductsPage() {
  const search = Route.useSearch();
  const data = Route.useLoaderData()!;
  const navigate = Route.useNavigate();
  const router = useRouter();

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
          className="flex items-center gap-3"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              name="keyword"
              defaultValue={search.keyword ?? ""}
              placeholder="搜索..."
              className="w-48 h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
          <select
            name="status"
            defaultValue={search.status ?? ""}
            className="h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <option value="">全部</option>
            <option value="online">上架</option>
            <option value="offline">下架</option>
          </select>
          <button
            type="submit"
            className="h-9 px-4 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-all"
          >
            筛选
          </button>
          <button
            type="button"
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
                ID
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                名称
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
                <td colSpan={5} className="text-center py-12 text-gray-400">
                  暂无商品
                </td>
              </tr>
            ) : (
              data.items.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50"
                >
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {p.id}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={"/products/" + p.id}
                      className="text-gray-900 hover:text-gray-600"
                    >
                      {p.name}
                    </Link>
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
                        to={"/products/" + p.id}
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
