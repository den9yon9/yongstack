import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Breadcrumb } from "../../components/Breadcrumb";
import { api } from "../../libs/api";

export const Route = createFileRoute("/_studio/categories")({
  staticData: { title: "类目管理", icon: "FolderTree" },
  component: CategoriesPage,
});

interface CatNode {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number | null;
  children: CatNode[];
}

function buildTree(
  flat: {
    id: number;
    name: string;
    parentId: number | null;
    sortOrder: number | null;
  }[],
): CatNode[] {
  const map = new Map<number, CatNode>();
  const roots: CatNode[] = [];
  for (const cat of flat) {
    map.set(cat.id, { ...cat, children: [] });
  }
  for (const cat of flat) {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function flatten(
  branches: CatNode[],
  level = 0,
): (CatNode & { level: number })[] {
  const result: (CatNode & { level: number })[] = [];
  for (const b of branches) {
    result.push({ ...b, level });
    if (b.children.length > 0) result.push(...flatten(b.children, level + 1));
  }
  return result;
}

function CategoriesPage() {
  const queryClient = useQueryClient();

  const { data: flatCategories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.product.categories.get();
      return (res.data ?? []) as {
        id: number;
        name: string;
        parentId: number | null;
        sortOrder: number | null;
      }[];
    },
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createParentId, setCreateParentId] = useState("");
  const [saving, setSaving] = useState(false);

  const catList = flatCategories ?? [];
  const tree = buildTree(catList);
  const flatList = flatten(tree);

  async function handleCreate() {
    if (!createName.trim()) return;
    setSaving(true);
    const res = await api.product.categories.post({
      name: createName.trim(),
      parentId: createParentId ? Number(createParentId) : undefined,
    });
    setSaving(false);
    if (res.error) {
      toast.error("创建失败");
      return;
    }
    toast.success("类目已创建");
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    setCreating(false);
    setCreateName("");
    setCreateParentId("");
  }

  function startEdit(cat: { id: number; name: string }) {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  async function handleUpdate() {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    const res = await api.product
      .categories({ id: editingId })
      .put({ name: editName.trim() });
    setSaving(false);
    if (res.error) {
      toast.error("更新失败");
      return;
    }
    toast.success("已更新");
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    setEditingId(null);
  }

  async function handleDelete(id: number) {
    if (!confirm("确定删除该类目？")) return;
    const res = await api.product.categories({ id }).delete();
    if (res.error) {
      toast.error("删除失败");
      return;
    }
    toast.success("已删除");
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  }

  return (
    <div className="p-6">
      <Breadcrumb>
        {creating ? (
          <div className="flex items-center gap-2">
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="类目名称"
              className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm w-40 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <select
              value={createParentId}
              onChange={(e) => setCreateParentId(e.target.value)}
              className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="">顶级类目</option>
              {flatCategories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="h-9 px-4 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setCreateName("");
              }}
              className="h-9 px-4 border border-gray-200 text-gray-500 hover:text-gray-900 text-sm font-medium rounded-lg transition-all"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 h-9 px-4 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" /> 新建类目
          </button>
        )}
      </Breadcrumb>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                名称
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">
                ID
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={3} className="text-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                </td>
              </tr>
            ) : flatList.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-12 text-gray-400">
                  暂无类目
                </td>
              </tr>
            ) : (
              flatList.map((cat) => (
                <tr
                  key={cat.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50"
                >
                  <td className="px-4 py-3">
                    {editingId === cat.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 px-3 rounded-lg border border-gray-200 bg-white text-sm w-40 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                        />
                        <button
                          type="button"
                          onClick={handleUpdate}
                          disabled={saving}
                          className="text-xs text-gray-900 hover:text-gray-600 font-medium"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <span
                        style={{ paddingLeft: `${cat.level * 20}px` }}
                        className="text-gray-900"
                      >
                        {cat.level > 0 && (
                          <span className="text-gray-300 mr-1">└─ </span>
                        )}
                        {cat.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {cat.id}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId !== cat.id && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(cat)}
                          className="text-xs text-gray-500 hover:text-gray-900"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cat.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
