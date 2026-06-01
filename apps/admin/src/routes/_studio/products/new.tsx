import { createFileRoute } from "@tanstack/react-router";
import { Breadcrumb } from "../../../components/Breadcrumb";
export const Route = createFileRoute("/_studio/products/new")({
  staticData: { title: "新建商品", showInNav: false },
  component: NewProductPage,
});

function NewProductPage() {
  return (
    <div className="p-6 max-w-3xl">
      <Breadcrumb />
      <div className="rounded-2xl border border-gray-100 bg-white p-8"></div>
    </div>
  );
}
