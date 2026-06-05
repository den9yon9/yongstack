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
      <div className="card bg-base-100 card-border">
        <div className="card-body">
          <h2 className="card-title">新建商品</h2>
          <p className="text-base-content/60">商品表单待实现</p>
        </div>
      </div>
    </div>
  );
}
