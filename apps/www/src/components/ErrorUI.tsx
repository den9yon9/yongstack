import { useState } from "react";

interface ParsedError {
  title: string;
  message: string;
  details: string | null;
  /** Flag to determine if it's an authentication error (401/403) */
  isAuthError?: boolean;
}

// --- Error Parsing Logic ---
const parseErrorDetails = (err: unknown): ParsedError => {
  // 1. Null or undefined
  if (err == null) {
    return {
      title: "Something went wrong",
      message: "An unexpected error occurred.",
      details: null,
    };
  }

  // 2. Fetch Response Object (Handling HTTP errors natively)
  if (err instanceof Response) {
    const statusText = err.statusText || "Unknown Status";
    const detailInfo = `Status: ${err.status} ${statusText}\nURL: ${err.url}`;

    // Auth errors (401 Unauthorized, 403 Forbidden)
    if (err.status === 401 || err.status === 403) {
      return {
        title: "Session Expired",
        message: "Please sign in again to continue.",
        details: detailInfo,
        isAuthError: true,
      };
    }

    // Other HTTP errors (404, 500, etc.)
    return {
      title: `Request Failed (${err.status})`,
      message: "The server encountered an error. Please try again later.",
      details: detailInfo,
    };
  }

  // 3. Standard Error Objects (including Fetch network disconnection)
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

  // 4. Plain Strings
  if (typeof err === "string") {
    return { title: "Notice", message: err, details: null };
  }

  // 5. Plain Objects (e.g., throw { code: -1, message: "..." })
  if (typeof err === "object") {
    const objErr = err as Record<string, any>;
    return {
      title: objErr.code ? `Error Code: ${objErr.code}` : "Unknown Error",
      message:
        objErr.message || objErr.msg || "An unrecognized error occurred.",
      details: safeStringify(err),
    };
  }

  // 6. Fallback
  return {
    title: "Unknown Error",
    message: String(err),
    details: null,
  };
};

// Safe JSON stringify to prevent circular reference crashes
const safeStringify = (obj: any): string | null => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return "[Unserializable Object]";
  }
};

interface ErrorUIProps {
  error: unknown;
  /** Callback for retry or login action */
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
    <div className="w-full px-6 py-10 flex flex-col items-center text-center max-w-md mx-auto font-sans selection:bg-gray-200">
      {/* Icon Area: Lock icon for Auth errors, Warning icon for others */}
      <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-5">
        {parsed.isAuthError ? (
          <svg
            className="w-7 h-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        ) : (
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        )}
      </div>

      {/* Text Area */}
      <h3 className="text-[17px] font-medium text-gray-900 mb-1.5 break-words">
        {parsed.title}
      </h3>
      <p className="text-[14px] text-gray-500 leading-relaxed break-words line-clamp-3">
        {parsed.message}
      </p>

      {/* Action Area */}
      <div className="mt-8 w-full flex flex-col items-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full sm:w-auto sm:min-w-[160px] h-12 flex items-center justify-center bg-gray-900 active:bg-gray-800 text-white text-[15px] font-medium rounded-2xl transition-transform active:scale-[0.98]"
          >
            {parsed.isAuthError ? "Sign In" : "Try Again"}
          </button>
        )}

        {/* Minimalist toggle button */}
        {parsed.details && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="h-10 px-4 flex items-center justify-center text-[13px] text-gray-400 active:text-gray-600 transition-colors"
          >
            {showDetails ? "Hide details" : "Show details"}
          </button>
        )}
      </div>

      {/* Details Block (Expanded state) */}
      {showDetails && parsed.details && (
        <div className="w-full mt-4 text-left relative animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            onClick={handleCopy}
            className="absolute top-2.5 right-2.5 p-1.5 text-gray-400 active:text-gray-700 bg-white/80 backdrop-blur rounded-lg shadow-sm border border-gray-100"
            aria-label="Copy to clipboard"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
          <pre className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-[11px] sm:text-xs text-gray-500 font-mono overflow-x-auto overflow-y-auto max-h-64 leading-relaxed whitespace-pre-wrap">
            <code>{parsed.details}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
