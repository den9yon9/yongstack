import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  staticData: { title: "首页", showInNav: false },
  component: App,
});

function App() {
  return <main>welcome</main>;
}
