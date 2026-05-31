import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { ErrorUI } from "./components/ErrorUI";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    defaultErrorComponent: (props) => <ErrorUI error={props.error} />,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
