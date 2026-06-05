import { createFileRoute } from "@tanstack/react-router";
import { Breadcrumb } from "../../components/Breadcrumb";

export const Route = createFileRoute("/_studio/dashboard")({
  staticData: { title: "仪表盘", icon: "LayoutDashboard" },
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="p-6">
      <Breadcrumb />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-base-100 card-border">
          <div className="card-body gap-2">
            <h3 className="text-base-content/60 text-sm">总商品数</h3>
            <p className="text-2xl font-bold text-base-content">--</p>
          </div>
        </div>
        <div className="card bg-base-100 card-border">
          <div className="card-body gap-2">
            <h3 className="text-base-content/60 text-sm">上架商品</h3>
            <p className="text-2xl font-bold text-success">--</p>
          </div>
        </div>
        <div className="card bg-base-100 card-border">
          <div className="card-body gap-2">
            <h3 className="text-base-content/60 text-sm">下架商品</h3>
            <p className="text-2xl font-bold text-base-content/60">--</p>
          </div>
        </div>
        <div className="card bg-base-100 card-border">
          <div className="card-body gap-2">
            <h3 className="text-base-content/60 text-sm">类目数</h3>
            <p className="text-2xl font-bold text-base-content">--</p>
          </div>
        </div>
      </div>
    </div>
  );
}
