import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRouter,
  RouterProvider,
  useNavigate,
} from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import { ErrorUI } from "./components/ErrorUI";
import { queryClient } from "./libs/queryClient";
import { routeTree } from "./routeTree.gen";
import "./prepare";
import { EdenFetchError } from "@elysiajs/eden";

function DefaultErrorComponent({ error }: { error: Error }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <ErrorUI
          error={error}
          onRetry={() => {
            if (error instanceof EdenFetchError && error.status === 401)
              navigate({ to: "/signin", replace: true });
            else router.invalidate();
          }}
        />
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
  interface StaticDataRouteOption {
    title: string;
    icon?: string;
    showInNav?: boolean;
    order?: number;
  }
}

const rootElement = document.getElementById("app")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" />
    </QueryClientProvider>,
  );
}
