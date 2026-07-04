import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_studio/products")({
  staticData: { title: "商品管理", icon: "Package", order: 10 },
  component: () => <Outlet />,
});
