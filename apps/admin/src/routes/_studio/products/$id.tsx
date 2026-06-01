import { createFileRoute } from "@tanstack/react-router";
import { Breadcrumb } from "../../../components/Breadcrumb";

export const Route = createFileRoute("/_studio/products/$id")({
  staticData: { title: "编辑商品", showInNav: false },
  component: EditProductPage,
});

function EditProductPage() {
  return (
    <div className="p-6 max-w-3xl">
      <Breadcrumb />
    </div>
  );
}
