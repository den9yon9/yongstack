import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Sidebar } from "../../components/Sidebar";

export const Route = createFileRoute("/_studio")({
  staticData: { title: "Studio" },
  component: StudioLayout,
});

function StudioLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
