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

  return (
    <div className="p-4">
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              name="keyword"
              defaultValue={search.keyword ?? ""}
              placeholder="搜索..."
              className="input input-bordered input-sm w-40 pl-9"
            />
          </div>
          <select
            name="status"
            defaultValue={search.status ?? ""}
            className="select select-bordered select-sm"
          >
            <option value="">全部状态</option>
            <option value="online">上架</option>
            <option value="offline">下架</option>
          </select>
          <select
            name="categoryId"
            defaultValue={search.categoryId ?? ""}
            className="select select-bordered select-sm"
          >
            <option value="">全部分类</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="join shrink-0">
            <button type="submit" className="btn btn-neutral btn-sm join-item">
              筛选
            </button>
            <button
              type="reset"
              onClick={() => navigate({ search: {} })}
              className="btn btn-ghost btn-sm join-item"
            >
              重置
            </button>
          </div>
        </form>
        <Link to="/products/new" className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" /> 新建
        </Link>
      </Breadcrumb>

      <div className="card bg-base-100 card-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>封面</th>
                <th>名称</th>
                <th>分类</th>
                <th>状态</th>
                <th>创建时间</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-base-content/40"
                  >
                    暂无商品
                  </td>
                </tr>
              ) : (
                data.items.map((p) => (
                  <tr key={p.id} className="hover">
                    <td>
                      {p.coverUrl ? (
                        <img
                          src={p.coverUrl}
                          alt=""
                          className="w-10 h-10 rounded-btn object-cover bg-base-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-btn bg-base-200" />
                      )}
                    </td>
                    <td>
                      <Link
                        to="/products/$id"
                        params={{ id: p.id.toString() }}
                        className="link link-hover text-base-content"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="text-base-content/60 text-xs">
                      {p.categoryId ? (catMap.get(p.categoryId) ?? "—") : "—"}
                    </td>
                    <td>
                      {p.status === "online" ? (
                        <span className="badge badge-success badge-soft">
                          上架
                        </span>
                      ) : (
                        <span className="badge badge-ghost">下架</span>
                      )}
                    </td>
                    <td className="text-base-content/60 text-xs">
                      {new Date(p.createdAt).toLocaleDateString("zh-CN")}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={"/products/$id"}
                          params={{ id: p.id.toString() }}
                          className="btn btn-ghost btn-xs"
                        >
                          编辑
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleToggle(p.id, p.status)}
                          className="btn btn-ghost btn-xs"
                        >
                          {p.status === "online" ? "下架" : "上架"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="btn btn-ghost btn-xs text-error"
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
      </div>

      <div className="flex items-center justify-center gap-2 mt-4">
        <button
          type="button"
          disabled={data.page <= 1}
          onClick={() =>
            navigate({ search: (prev) => ({ ...prev, page: data.page - 1 }) })
          }
          className="btn btn-sm btn-ghost"
        >
          上一页
        </button>
        <span className="btn btn-sm btn-ghost no-animation cursor-default">
          {data.page} / {data.totalPage}
        </span>
        <button
          type="button"
          disabled={data.page >= data.totalPage}
          onClick={() =>
            navigate({ search: (prev) => ({ ...prev, page: data.page + 1 }) })
          }
          className="btn btn-sm btn-ghost"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
