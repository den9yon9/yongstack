import { EdenFetchError } from "@elysiajs/eden";
import { AlertTriangle, Copy, Lock, UnfoldVertical } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/Button";

interface ParsedError {
  title: string;
  message: string;
  details: string | null;
  isAuthError?: boolean;
}

const parseErrorDetails = (err: unknown): ParsedError => {
  if (err == null) {
    return {
      title: "Something went wrong",
      message: "An unexpected error occurred.",
      details: null,
    };
  }

  if (err instanceof EdenFetchError) {
    const detailInfo = err.value;

    if (err.status === 401 || err.status === 403) {
      return {
        title: "Session Expired",
        message: "Please sign in again to continue.",
        details: detailInfo,
        isAuthError: true,
      };
    }

    return {
      title: `Request Failed (${err.status})`,
      message: "The server encountered an error. Please try again later.",
      details: detailInfo,
    };
  }

  if (err instanceof Error) {
    const isNetworkError = err.message === "Failed to fetch";
    return {
      title: isNetworkError ? "Network Error" : "Application Error",
      message: isNetworkError
        ? "Please check your internet connection and try again."
        : err.message,
      details: err.stack || null,
    };
  }

  if (typeof err === "string") {
    return { title: "Notice", message: err, details: null };
  }

  if (typeof err === "object") {
    const objErr = err as { code?: number; message?: string; msg?: string };
    return {
      title: objErr.code ? `Error Code: ${objErr.code}` : "Unknown Error",
      message:
        objErr.message || objErr.msg || "An unrecognized error occurred.",
      details: safeStringify(err),
    };
  }

  return {
    title: "Unknown Error",
    message: String(err),
    details: null,
  };
};

const safeStringify = (obj: unknown): string | null => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (_e) {
    return "[Unserializable Object]";
  }
};

interface ErrorUIProps {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorUI({ error, onRetry }: ErrorUIProps) {
  const [showDetails, setShowDetails] = useState(false);
  const parsed = parseErrorDetails(error);

  const handleCopy = () => {
    const text = `[${parsed.title}]\n${parsed.message}\n\n${parsed.details || "No additional details"}`;
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard");
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className={`mb-4 flex size-14 items-center justify-center rounded-full ${
          parsed.isAuthError ? "bg-warning-soft" : "bg-danger-soft"
        }`}
      >
        {parsed.isAuthError ? (
          <Lock className="size-7 text-warning" />
        ) : (
          <AlertTriangle className="size-7 text-danger" />
        )}
      </div>

      <h3 className="mb-1 text-lg font-semibold text-text">{parsed.title}</h3>
      <p className="mb-6 max-w-md text-sm text-text-secondary">
        {parsed.message}
      </p>

      <div className="flex items-center gap-3">
        {onRetry && (
          <Button
            onClick={onRetry}
            variant={parsed.isAuthError ? "primary" : "danger"}
          >
            {parsed.isAuthError ? "Sign In" : "Try Again"}
          </Button>
        )}

        {parsed.details && (
          <Button variant="ghost" onClick={() => setShowDetails(!showDetails)}>
            <UnfoldVertical className="size-4" />
            {showDetails ? "Hide details" : "Show details"}
          </Button>
        )}
      </div>

      {showDetails && parsed.details && (
        <div className="mt-6 w-full max-w-lg">
          <div className="relative rounded-lg border border-border bg-surface-hover p-4">
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-2 top-2 rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text"
              aria-label="Copy to clipboard"
            >
              <Copy className="size-4" />
            </button>
            <pre className="overflow-x-auto text-left text-xs text-text-secondary">
              <code>{parsed.details}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
