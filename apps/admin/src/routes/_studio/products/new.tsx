import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ImagePlus, Plus, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import * as v from "valibot";
import { Breadcrumb } from "../../../components/Breadcrumb";
import { Button } from "../../../components/ui/Button";
import { Card, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { api } from "../../../libs/api";

export const Route = createFileRoute("/_studio/products/new")({
  staticData: { title: "新建商品", showInNav: false },
  component: NewProductPage,
});

interface AttrRow {
  id: string;
  key: string;
  value: string;
}

interface SkuEntry {
  id: string;
  attrs: AttrRow[];
  price: string;
  originalPrice: string;
  stock: string;
}

let _id = 0;
function uid() {
  return `f_${++_id}`;
}

function createAttr(): AttrRow {
  return { id: uid(), key: "", value: "" };
}

function createSku(): SkuEntry {
  return {
    id: uid(),
    attrs: [createAttr()],
    price: "",
    originalPrice: "",
    stock: "",
  };
}

const attrRowSchema = v.object({
  key: v.pipe(v.string(), v.minLength(1, "请输入规格名")),
  value: v.pipe(v.string(), v.minLength(1, "请输入规格值")),
});

const skuSchema = v.object({
  attrs: v.pipe(v.array(attrRowSchema), v.minLength(1, "至少一个规格")),
  price: v.pipe(
    v.string(),
    v.transform(parseFloat),
    v.number("请输入有效价格"),
    v.minValue(0.01, "价格不能为 0"),
  ),
  originalPrice: v.optional(
    v.pipe(
      v.string(),
      v.transform(parseFloat),
      v.number("请输入有效价格"),
      v.minValue(0),
    ),
  ),
  stock: v.optional(
    v.pipe(
      v.string(),
      v.transform(parseFloat),
      v.number("请输入有效库存"),
      v.minValue(0),
    ),
  ),
});

const formSchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "请输入商品名称"),
    v.maxLength(200, "商品名称不超过 200 字"),
  ),
  categoryId: v.optional(v.string()),
  status: v.optional(v.union([v.literal("online"), v.literal("offline")])),
  description: v.optional(v.string()),
  skus: v.optional(v.array(skuSchema)),
});

const STATUS_OPTIONS = [
  { value: "offline", label: "下架" },
  { value: "online", label: "上架" },
] as const;

function NewProductPage() {
  const navigate = useNavigate();
  const coverInputRef = useRef<HTMLInputElement>(null);

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

  const [coverPreview, setCoverPreview] = useState("");
  const [skus, setSkus] = useState<SkuEntry[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function handleCoverSelect(file: File | null) {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(file ? URL.createObjectURL(file) : "");
  }

  function handleRemoveCover() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview("");
    if (coverInputRef.current) coverInputRef.current.value = "";
  }

  function addSku() {
    setSkus((prev) => [...prev, createSku()]);
  }

  function removeSku(id: string) {
    setSkus((prev) => prev.filter((s) => s.id !== id));
  }

  function updateSkuAttr(
    skuId: string,
    attrId: string,
    field: "key" | "value",
    val: string,
  ) {
    setSkus((prev) =>
      prev.map((sku) =>
        sku.id === skuId
          ? {
              ...sku,
              attrs: sku.attrs.map((a) =>
                a.id === attrId ? { ...a, [field]: val } : a,
              ),
            }
          : sku,
      ),
    );
  }

  function addSkuAttr(skuId: string) {
    setSkus((prev) =>
      prev.map((sku) =>
        sku.id === skuId
          ? { ...sku, attrs: [...sku.attrs, createAttr()] }
          : sku,
      ),
    );
  }

  function removeSkuAttr(skuId: string, attrId: string) {
    setSkus((prev) =>
      prev.map((sku) =>
        sku.id === skuId
          ? { ...sku, attrs: sku.attrs.filter((a) => a.id !== attrId) }
          : sku,
      ),
    );
  }

  function updateSkuField(
    skuId: string,
    field: "price" | "originalPrice" | "stock",
    val: string,
  ) {
    setSkus((prev) =>
      prev.map((sku) => (sku.id === skuId ? { ...sku, [field]: val } : sku)),
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    const categoryId = (fd.get("categoryId") as string) || undefined;
    const status = fd.get("status") as "online" | "offline";
    const description = (fd.get("description") as string) || undefined;
    const coverFile = coverInputRef.current?.files?.[0];

    const parsed = v.safeParse(formSchema, {
      name,
      categoryId,
      status,
      description,
      skus:
        skus.length > 0
          ? skus.map((s) => ({
              ...s,
              originalPrice: s.originalPrice || undefined,
              stock: s.stock || undefined,
            }))
          : undefined,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.issues) {
        const key = issue.path?.[0]?.key;
        if (
          key &&
          typeof key === "string" &&
          key === "name" &&
          !fieldErrors[key]
        ) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      if (fieldErrors.name) {
        toast.error(fieldErrors.name);
      } else {
        toast.error("请检查表单中的错误");
      }
      return;
    }

    setSubmitting(true);

    try {
      const skusFormatted = skus.map((sku) => ({
        attrs: Object.fromEntries(sku.attrs.map((a) => [a.key, a.value])),
        price: Math.round(parseFloat(sku.price) * 100),
        ...(sku.originalPrice
          ? { originalPrice: Math.round(parseFloat(sku.originalPrice) * 100) }
          : {}),
        ...(sku.stock ? { stock: parseInt(sku.stock, 10) } : {}),
      }));

      const res = await api.products.post({
        name,
        categoryId,
        status,
        description,
        cover: coverFile ?? undefined,
        skus: skusFormatted.length > 0 ? skusFormatted : undefined,
      });
      if (res.error) {
        toast.error(
          typeof res.error === "object" && res.error !== null
            ? String((res.error as Record<string, unknown>).value ?? res.error)
            : "创建失败",
        );
        setSubmitting(false);
        return;
      }

      toast.success("创建成功");
      navigate({ to: "/products" });
    } catch {
      toast.error("网络错误");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Breadcrumb />
      <form onSubmit={handleSubmit} className="space-y-5">
        <Card padding={false} className="p-4">
          <CardHeader title="基本信息" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label="商品名称"
              name="name"
              defaultValue=""
              error={errors.name}
              required
              maxLength={200}
            />
            <Select label="所属类目" name="categoryId" defaultValue="">
              <option value="">请选择类目</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-text">
              封面图
            </label>
            {coverPreview ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
                <img
                  src={coverPreview}
                  alt=""
                  className="size-14 shrink-0 rounded-md border border-border object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text">
                    {coverInputRef.current?.files?.[0]?.name ?? ""}
                  </p>
                  <p className="text-xs text-text-muted">
                    {coverInputRef.current?.files?.[0]
                      ? `${(coverInputRef.current.files[0].size / 1024).toFixed(1)} KB`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleRemoveCover}
                    aria-label="移除图片"
                  >
                    <X className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => coverInputRef.current?.click()}
                    aria-label="更换图片"
                  >
                    <Upload className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border py-5 transition-colors hover:border-primary hover:bg-primary-soft/30"
              >
                <div className="flex size-9 items-center justify-center rounded-full bg-surface-hover">
                  <ImagePlus className="size-5 text-text-muted" />
                </div>
                <div className="text-left">
                  <p className="text-sm text-text-secondary">点击上传封面图</p>
                  <p className="text-xs text-text-muted">
                    JPG / PNG / WebP，最大 10MB
                  </p>
                </div>
              </button>
            )}
            <input
              ref={coverInputRef}
              name="cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCoverSelect(f);
              }}
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select label="状态" name="status" defaultValue="offline">
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium text-text">
              商品描述
            </label>
            <textarea
              name="description"
              defaultValue=""
              placeholder="请输入商品描述..."
              rows={3}
              className="block w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </Card>

        <Card padding={false} className="p-4">
          <CardHeader
            title="SKU 管理"
            action={
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={addSku}
              >
                <Plus className="size-4" />
                添加 SKU
              </Button>
            }
          />
          {skus.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">
              暂无 SKU，点击上方按钮添加
            </p>
          ) : (
            <div className="space-y-3">
              {skus.map((sku, idx) => (
                <div
                  key={sku.id}
                  className="rounded-lg border border-border bg-surface p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-text">
                      SKU #{idx + 1}
                    </span>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => removeSku(sku.id)}
                    >
                      <Trash2 className="size-3.5" />
                      删除
                    </Button>
                  </div>

                  <div className="mb-2 space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">
                      规格属性
                    </label>
                    {sku.attrs.map((attr) => (
                      <div key={attr.id} className="flex items-center gap-1.5">
                        <input
                          value={attr.key}
                          onChange={(e) =>
                            updateSkuAttr(
                              sku.id,
                              attr.id,
                              "key",
                              e.target.value,
                            )
                          }
                          placeholder="规格名"
                          className="block h-8 w-24 rounded-md border border-border bg-surface px-2 text-sm text-text placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <span className="text-text-muted">:</span>
                        <input
                          value={attr.value}
                          onChange={(e) =>
                            updateSkuAttr(
                              sku.id,
                              attr.id,
                              "value",
                              e.target.value,
                            )
                          }
                          placeholder="规格值"
                          className="block h-8 flex-1 rounded-md border border-border bg-surface px-2 text-sm text-text placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        {sku.attrs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSkuAttr(sku.id, attr.id)}
                            className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-danger"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addSkuAttr(sku.id)}
                    >
                      <Plus className="size-3.5" />
                      添加属性
                    </Button>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <label className="mb-0.5 block text-xs font-medium text-text-secondary">
                        销售价
                      </label>
                      <div className="relative">
                        <input
                          value={sku.price}
                          onChange={(e) =>
                            updateSkuField(sku.id, "price", e.target.value)
                          }
                          placeholder="0.00"
                          type="number"
                          step="0.01"
                          min="0"
                          className="block h-8 w-full rounded-md border border-border bg-surface px-2 pr-6 text-sm text-text placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">
                          元
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="mb-0.5 block text-xs font-medium text-text-secondary">
                        原价
                      </label>
                      <div className="relative">
                        <input
                          value={sku.originalPrice}
                          onChange={(e) =>
                            updateSkuField(
                              sku.id,
                              "originalPrice",
                              e.target.value,
                            )
                          }
                          placeholder="0.00"
                          type="number"
                          step="0.01"
                          min="0"
                          className="block h-8 w-full rounded-md border border-border bg-surface px-2 pr-6 text-sm text-text placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">
                          元
                        </span>
                      </div>
                    </div>
                    <div className="w-24 shrink-0">
                      <label className="mb-0.5 block text-xs font-medium text-text-secondary">
                        库存
                      </label>
                      <input
                        value={sku.stock}
                        onChange={(e) =>
                          updateSkuField(sku.id, "stock", e.target.value)
                        }
                        placeholder="0"
                        type="number"
                        step="1"
                        min="0"
                        className="block h-8 w-full rounded-md border border-border bg-surface px-2 text-sm text-text placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Link to="/products">
            <Button type="button" variant="ghost">
              取消
            </Button>
          </Link>
          <Button type="submit" loading={submitting}>
            {submitting ? "创建中..." : "创建商品"}
          </Button>
        </div>
      </form>
    </div>
  );
}
