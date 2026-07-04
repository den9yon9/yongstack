import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Breadcrumb } from "../../components/Breadcrumb";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
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
      map.get(cat.parentId)?.children.push(node);
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
      className="mt-2 flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        value={createName}
        onChange={(e) => setCreateName(e.target.value)}
        placeholder="类目名称"
        className="block h-8 w-48 rounded-md border border-border bg-surface px-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCreate();
          if (e.key === "Escape") {
            setCreateTarget(null);
            setCreateName("");
          }
        }}
      />
      <Button
        size="sm"
        onClick={handleCreate}
        disabled={saving || !createName.trim()}
      >
        {saving ? "保存中..." : "保存"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setCreateTarget(null);
          setCreateName("");
        }}
      >
        取消
      </Button>
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
          className="block h-8 w-48 rounded-md border border-border bg-surface px-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleUpdate();
            if (e.key === "Escape") setEditingId(null);
          }}
        />
        <Button size="sm" onClick={handleUpdate} disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
          取消
        </Button>
      </div>
    );

    return (
      <div className="group">
        {isEditing ? (
          <div className="py-1">{editForm}</div>
        ) : (
          <div
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text transition-colors hover:bg-surface-hover"
            onContextMenu={handleContextMenu}
          >
            <FolderOpen className="size-4 shrink-0 text-warning" />
            <span className="font-medium">{node.name}</span>
            {hasChildren && (
              <span className="ml-auto text-xs text-text-muted">
                {node.children.length} 子项
              </span>
            )}
          </div>
        )}
        {showCreate && createForm}
        {hasChildren && (
          <div className="ml-4 border-l border-border pl-3">
            {node.children.map((child) => (
              <div key={child.id}>{renderTreeNode(child)}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const handleEmptyContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node: undefined });
  };

  return (
    <div>
      <Breadcrumb>
        <Button
          size="sm"
          onClick={() => {
            setCreateTarget({ parentId: null });
            setCreateName("");
          }}
        >
          <Plus className="size-4" />
          新建顶级类目
        </Button>
      </Breadcrumb>

      <Card>
        <div className="text-sm text-text-secondary">
          右键类目名称可编辑、新建子类目或删除
        </div>
      </Card>

      <div className="mt-5">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-8 w-40" />
          </div>
        ) : (
          <div
            className="rounded-lg border border-border bg-surface p-4 shadow-card"
            onContextMenu={handleEmptyContextMenu}
          >
            {createTarget?.parentId === null && (
              <div className="mb-2">{createForm}</div>
            )}
            {tree.length === 0 && !createTarget ? (
              <div className="py-8 text-center text-sm text-text-muted">
                暂无类目，点击右上角"新建顶级类目"或右键空白区域新建
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="space-y-1">
                  {tree.map((node) => (
                    <div key={node.id}>{renderTreeNode(node)}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
            className="fixed z-50 min-w-36 rounded-lg border border-border bg-surface py-1 shadow-dropdown"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {(() => {
              const cmNode = contextMenu.node;
              return cmNode ? (
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      startEdit(cmNode);
                      closeContextMenu();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-text transition-colors hover:bg-surface-hover"
                  >
                    <Pencil className="size-4 text-text-muted" />
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateTarget({ parentId: cmNode.id });
                      setCreateName("");
                      closeContextMenu();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-text transition-colors hover:bg-surface-hover"
                  >
                    <Plus className="size-4 text-text-muted" />
                    新建子类目
                  </button>
                  <hr className="my-1 border-border" />
                  <button
                    type="button"
                    onClick={() => {
                      handleDelete(cmNode.id);
                      closeContextMenu();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
                  >
                    <Trash2 className="size-4" />
                    删除
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCreateTarget({ parentId: null });
                    setCreateName("");
                    closeContextMenu();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-text transition-colors hover:bg-surface-hover"
                >
                  <Plus className="size-4 text-text-muted" />
                  新建顶级类目
                </button>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
