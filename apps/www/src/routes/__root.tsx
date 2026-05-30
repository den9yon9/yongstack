import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { parseError } from "../libs/error";

import "../styles.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const message = parseError(event.error);
      toast.error("Error", { description: message });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const message = parseError(event.reason);
      toast.error("Error", { description: message });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return (
    <>
      <Outlet />
    </>
  );
}
