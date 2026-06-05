import { createFileRoute } from "@tanstack/react-router";
import { Breadcrumb } from "../../../components/Breadcrumb";

export const Route = createFileRoute("/_studio/products/$id")({
  staticData: { title: "编辑商品", showInNav: false },
  component: EditProductPage,
});

function EditProductPage() {
  const { id } = Route.useParams();
  return (
    <div className="p-6 max-w-3xl">
      <Breadcrumb />
      <div className="card bg-base-100 card-border">
        <div className="card-body">
          <h2 className="card-title">编辑商品 #{id}</h2>
          <p className="text-base-content/60">商品编辑表单待实现</p>
        </div>
      </div>
    </div>
  );
}
