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
      <p className="text-gray-500">welcome</p>
    </div>
  );
}
