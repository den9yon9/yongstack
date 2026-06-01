import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface AttrsEntry {
  key: string;
  value: string;
}

interface SKUFormEntry {
  attrs: AttrsEntry[];
  price: string;
  originalPrice: string;
  stock: string;
  image: string;
}

export interface ProductFormData {
  name: string;
  description: string;
  categoryId: string;
  coverUrl: string;
  status: "online" | "offline";
  skus: {
    attrs: Record<string, string>;
    price: number;
    originalPrice?: number;
    stock: number;
    image?: string;
  }[];
}

interface CategoryOption {
  id: number;
  name: string;
  children?: CategoryOption[];
}

interface Props {
  initial?: Partial<ProductFormData>;
  categories: CategoryOption[];
  loading: boolean;
  onSubmit: (data: ProductFormData) => void;
}

function flattenCategories(
  cats: CategoryOption[],
  level = 0,
): { id: number; label: string }[] {
  const result: { id: number; label: string }[] = [];
  for (const c of cats) {
    result.push({ id: c.id, label: `${"  ".repeat(level)}${c.name}` });
    if (c.children) result.push(...flattenCategories(c.children, level + 1));
  }
  return result;
}

function parseAttrs(entries: AttrsEntry[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const e of entries) {
    if (e.key.trim()) obj[e.key.trim()] = e.value;
  }
  return obj;
}

function attrsToEntries(attrs: Record<string, string>): AttrsEntry[] {
  return Object.entries(attrs).map(([key, value]) => ({ key, value }));
}

function defaultSku(): SKUFormEntry {
  return {
    attrs: [{ key: "", value: "" }],
    price: "",
    originalPrice: "",
    stock: "0",
    image: "",
  };
}

export function ProductForm({ initial, categories, loading, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? "");
  const [status, setStatus] = useState<"online" | "offline">(
    initial?.status ?? "offline",
  );
  const [skus, setSkus] = useState<SKUFormEntry[]>(
    initial?.skus?.map((s) => ({
      attrs: s.attrs ? attrsToEntries(s.attrs) : [{ key: "", value: "" }],
      price: s.price?.toString() ?? "",
      originalPrice: s.originalPrice?.toString() ?? "",
      stock: s.stock?.toString() ?? "0",
      image: s.image ?? "",
    })) ?? [defaultSku()],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      description,
      categoryId,
      coverUrl,
      status,
      skus: skus.map((s) => ({
        attrs: parseAttrs(s.attrs),
        price: Number(s.price),
        originalPrice: s.originalPrice ? Number(s.originalPrice) : undefined,
        stock: Number(s.stock),
        image: s.image || undefined,
      })),
    });
  }

  function updateSku(
    index: number,
    field: keyof SKUFormEntry,
    value: string | AttrsEntry[],
  ) {
    setSkus((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addSku() {
    setSkus((prev) => [...prev, defaultSku()]);
  }

  function removeSku(index: number) {
    setSkus((prev) => prev.filter((_, i) => i !== index));
  }

  const flatCategories = flattenCategories(categories);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            商品名称
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            分类
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <option value="">无分类</option>
            {flatCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            状态
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "online" | "offline")}
            className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <option value="offline">下架</option>
            <option value="online">上架</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            封面图 URL
          </label>
          <input
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          描述
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">SKU 规格</label>
          <button
            type="button"
            onClick={addSku}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <Plus className="w-4 h-4" /> 添加 SKU
          </button>
        </div>
        <div className="space-y-3">
          {skus.map((sku, i) => {
            const skuKey = `${i}`;
            return (
              <div
                key={skuKey}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500">
                    SKU #{i + 1}
                  </span>
                  {skus.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSku(i)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">
                      规格键
                    </label>
                    <input
                      value={sku.attrs[0]?.key ?? ""}
                      onChange={(e) => {
                        const attrs = sku.attrs.map((a, j) =>
                          j === 0 ? { ...a, key: e.target.value } : a,
                        );
                        if (sku.attrs.length === 0)
                          attrs.push({ key: e.target.value, value: "" });
                        updateSku(i, "attrs", attrs);
                      }}
                      placeholder="例: 颜色"
                      className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">
                      规格值
                    </label>
                    <input
                      value={sku.attrs[0]?.value ?? ""}
                      onChange={(e) => {
                        const attrs = sku.attrs.map((a, j) =>
                          j === 0 ? { ...a, value: e.target.value } : a,
                        );
                        if (sku.attrs.length === 0)
                          attrs.push({ key: "", value: e.target.value });
                        updateSku(i, "attrs", attrs);
                      }}
                      placeholder="例: 红色"
                      className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">
                      价格(分)
                    </label>
                    <input
                      type="number"
                      value={sku.price}
                      onChange={(e) => updateSku(i, "price", e.target.value)}
                      required
                      className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">
                      库存
                    </label>
                    <input
                      type="number"
                      value={sku.stock}
                      onChange={(e) => updateSku(i, "stock", e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          type="submit"
          disabled={loading}
          className="h-11 px-8 flex items-center justify-center bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white text-sm font-medium rounded-xl transition-all active:scale-[0.98]"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
        </button>
      </div>
    </form>
  );
}
