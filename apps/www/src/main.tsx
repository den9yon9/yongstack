import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { toast } from "sonner";
import { ErrorUI } from "./components/ErrorUI";
import { parseError } from "./libs/error";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error }: { error: Error }) {
  // 解析并 toast 错误
  const message = parseError(error);
  toast.error(error.name || "Error", { description: message });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <ErrorUI error={error} onRetry={() => window.location.reload()} />
      </div>
    </div>
  );
}

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultErrorComponent: DefaultErrorComponent,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<RouterProvider router={router} />);
}
