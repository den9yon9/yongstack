import { toast } from "sonner";
import { parseError } from "./libs/error";

window.addEventListener("error", (event: ErrorEvent) => {
  const message = parseError(event.error);
  toast.error("Error", { description: message });
});

window.addEventListener(
  "unhandledrejection",
  (event: PromiseRejectionEvent) => {
    const message = parseError(event.reason);
    toast.error("Error", { description: message });
  },
);
