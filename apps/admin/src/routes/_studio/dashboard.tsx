import { createFileRoute, useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/_studio/dashboard")({
  staticData: { title: "仪表盘", icon: "LayoutDashboard" },
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  console.log(router, 889);
  return <main>welcome</main>;
}
