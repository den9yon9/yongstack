import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumb } from "../../../components/Breadcrumb";
import {
  ProductForm,
  type ProductFormData,
} from "../../../components/ProductForm";
import { api } from "../../../libs/api";

export const Route = createFileRoute("/_studio/products/$id")({
  staticData: { title: "编辑商品", showInNav: false },
  component: EditProductPage,
});

function EditProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: product, isLoading: productLoading } = useQuery(
    api.product({ id: Number(id) }).get.queryOptions(),
  );

  const { data: categories } = useQuery(
    api.product.categories.get.queryOptions(),
  );

  const mutation = useMutation(
    api.product({ id: Number(id) }).put.mutationOptions({
      onSuccess: () => {
        toast.success("商品已更新");
        queryClient.invalidateQueries({ queryKey: ["product"] });
        navigate({ to: "/products" });
      },
      onError: (err) => toast.error("更新失败", { description: String(err) }),
    }),
  );

  function handleSubmit(data: ProductFormData) {
    mutation.mutate({
      name: data.name,
      description: data.description || undefined,
      categoryId: data.categoryId ? Number(data.categoryId) : undefined,
      coverUrl: data.coverUrl || undefined,
      status: data.status,
      skus:
        data.skus.length > 0
          ? data.skus.map((s) => ({
              attrs: s.attrs,
              price: s.price,
              originalPrice: s.originalPrice || undefined,
              stock: s.stock,
              image: s.image || undefined,
            }))
          : undefined,
    });
  }

  if (productLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6 text-center text-gray-400 py-12">商品不存在</div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <Breadcrumb />
      <div className="rounded-2xl border border-gray-100 bg-white p-8">
        <ProductForm
          initial={{
            name: product.name,
            description: product.description ?? "",
            categoryId: product.categoryId?.toString() ?? "",
            coverUrl: product.coverUrl ?? "",
            status: product.status,
            skus:
              product.skus?.map((s) => ({
                attrs: s.attrs as Record<string, string>,
                price: s.price,
                originalPrice: s.originalPrice ?? undefined,
                stock: s.stock,
                image: s.image ?? undefined,
              })) ?? [],
          }}
          categories={categories ?? []}
          loading={mutation.isPending}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
