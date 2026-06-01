import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Breadcrumb } from "../../../components/Breadcrumb";
import {
  ProductForm,
  type ProductFormData,
} from "../../../components/ProductForm";
import { api } from "../../../libs/api";

export const Route = createFileRoute("/_studio/products/new")({
  staticData: { title: "新建商品", showInNav: false },
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: categories } = useQuery(
    api.product.categories.get.queryOptions(),
  );

  const mutation = useMutation(
    api.product.post.mutationOptions({
      onSuccess: () => {
        toast.success("商品已创建");
        queryClient.invalidateQueries({ queryKey: ["product"] });
        navigate({ to: "/products" });
      },
      onError: (err) => toast.error("创建失败", { description: String(err) }),
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

  return (
    <div className="p-6 max-w-3xl">
      <Breadcrumb />
      <div className="rounded-2xl border border-gray-100 bg-white p-8">
        <ProductForm
          categories={categories ?? []}
          loading={mutation.isPending}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
