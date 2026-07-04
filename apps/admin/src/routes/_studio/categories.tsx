import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Breadcrumb } from "../../components/Breadcrumb";
import { api } from "../../libs/api";

export const Route = createFileRoute("/_studio/categories")({
  staticData: { title: "类目管理", icon: "FolderTree", order: 20 },
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

function CategoriesPage() {
  const queryClient = useQueryClient();

  const { data: flatCategories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.categories.get();
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

  const [createTarget, setCreateTarget] = useState<{
    parentId: number | null;
  } | null>(null);
  const [createName, setCreateName] = useState("");

  const [saving, setSaving] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: CatNode | undefined;
  } | null>(null);

  const catList = flatCategories ?? [];
  const tree = buildTree(catList);

  async function handleCreate() {
    if (!createName.trim() || !createTarget) return;
    setSaving(true);
    const res = await api.categories.post({
      name: createName.trim(),
      parentId: createTarget.parentId ?? undefined,
    });
    setSaving(false);
    if (res.error) {
      toast.error("创建失败");
      return;
    }
    toast.success("类目已创建");
    setCreateTarget(null);
    setCreateName("");
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  }

  function startEdit(cat: { id: number; name: string }) {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  async function handleUpdate() {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    const res = await api
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
    const res = await api.categories({ id }).delete();
    if (res.error) {
      toast.error("删除失败");
      return;
    }
    toast.success("已删除");
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  const createForm = (
    <div
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        value={createName}
        onChange={(e) => setCreateName(e.target.value)}
        placeholder="类目名称"
        className="input input-bordered input-sm w-40"
        autoFocus
      />
      <button
        type="button"
        onClick={handleCreate}
        disabled={saving || !createName.trim()}
        className="btn btn-primary btn-sm"
      >
        {saving ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          "保存"
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          setCreateTarget(null);
          setCreateName("");
        }}
        className="btn btn-ghost btn-sm"
      >
        取消
      </button>
    </div>
  );

  function renderTreeNode(node: CatNode): React.ReactNode {
    const isEditing = editingId === node.id;
    const hasChildren = node.children.length > 0;
    const showCreate = createTarget?.parentId === node.id;

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, node });
    };

    const editForm = (
      <div
        className="flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="input input-bordered input-sm w-40"
          autoFocus
        />
        <button
          type="button"
          onClick={handleUpdate}
          disabled={saving}
          className="btn btn-primary btn-sm"
        >
          {saving ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            "保存"
          )}
        </button>
        <button
          type="button"
          onClick={() => setEditingId(null)}
          className="btn btn-ghost btn-sm"
        >
          取消
        </button>
      </div>
    );

    if (isEditing) {
      if (hasChildren) {
        return (
          <details open className="w-full">
            <summary className="flex items-center gap-2 w-full">
              {editForm}
            </summary>
            <ul>
              {node.children.map((child) => (
                <li key={child.id}>{renderTreeNode(child)}</li>
              ))}
              {showCreate && <li>{createForm}</li>}
            </ul>
          </details>
        );
      }
      return (
        <div className="flex items-center gap-2 px-3 py-2 w-full">
          {editForm}
        </div>
      );
    }

    if (hasChildren) {
      return (
        <details open className="w-full">
          <summary
            className="flex items-center justify-between gap-2 w-full"
            onContextMenu={handleContextMenu}
          >
            <span>{node.name}</span>
          </summary>
          <ul>
            {node.children.map((child) => (
              <li key={child.id}>{renderTreeNode(child)}</li>
            ))}
            {showCreate && <li>{createForm}</li>}
          </ul>
        </details>
      );
    }

    return (
      <>
        <button
          type="button"
          className="flex items-center justify-between gap-2 w-full"
          onContextMenu={handleContextMenu}
        >
          <span>{node.name}</span>
        </button>
        {showCreate && (
          <ul>
            <li>{createForm}</li>
          </ul>
        )}
      </>
    );
  }

  const handleEmptyContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node: undefined });
  };

  return (
    <div className="p-6">
      <Breadcrumb />

      {isLoading ? (
        <div className="card bg-base-100 card-border">
          <div className="card-body items-center py-12">
            <span className="loading loading-spinner loading-md text-base-content/40" />
          </div>
        </div>
      ) : (
        <div className="card bg-base-100 card-border overflow-hidden">
          <ul
            className="menu w-full pb-9"
            onContextMenu={handleEmptyContextMenu}
          >
            {createTarget?.parentId === null && <li>{createForm}</li>}
            {tree.length === 0 && !createTarget ? (
              <li>
                <div className="flex items-center justify-center py-8 text-base-content/40">
                  暂无类目，右键空白区域新建
                </div>
              </li>
            ) : (
              tree.map((node) => <li key={node.id}>{renderTreeNode(node)}</li>)
            )}
          </ul>
        </div>
      )}

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeContextMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              closeContextMenu();
            }}
          />
          <div
            className="fixed z-50"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <ul className="menu menu-sm bg-base-100 rounded-box shadow-lg border border-base-300 w-40">
              {(() => {
                const cmNode = contextMenu.node;
                return cmNode ? (
                  <>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          startEdit(cmNode);
                          closeContextMenu();
                        }}
                      >
                        <Pencil className="w-4 h-4" /> 编辑
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateTarget({ parentId: cmNode.id });
                          setCreateName("");
                          closeContextMenu();
                        }}
                      >
                        <Plus className="w-4 h-4" /> 新建子类目
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          handleDelete(cmNode.id);
                          closeContextMenu();
                        }}
                        className="text-error"
                      >
                        <Trash2 className="w-4 h-4" /> 删除
                      </button>
                    </li>
                  </>
                ) : (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateTarget({ parentId: null });
                        setCreateName("");
                        closeContextMenu();
                      }}
                    >
                      <Plus className="w-4 h-4" /> 新建顶级类目
                    </button>
                  </li>
                );
              })()}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
