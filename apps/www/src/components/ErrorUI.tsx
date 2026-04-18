import { parseError } from "../libs/error";

interface ErrorUIProps {
  error: unknown;
}

function extractErrorInfo(error: unknown): {
  name: string;
  message: string;
  stack?: string;
  details?: string;
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return {
      name: "StringError",
      message: error,
    };
  }

  if (typeof error === "object" && error !== null) {
    try {
      return {
        name: "ObjectError",
        message: parseError(error),
        details: JSON.stringify(error, null, 2),
      };
    } catch {
      return {
        name: "ObjectError",
        message: parseError(error),
      };
    }
  }

  return {
    name: "UnknownError",
    message: parseError(error),
  };
}

export function ErrorUI({ error }: ErrorUIProps) {
  const errorInfo = extractErrorInfo(error);

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
          {errorInfo.name}
        </span>
      </div>

      <p className="mb-3 text-sm text-red-700">{errorInfo.message}</p>

      {errorInfo.details && (
        <pre className="mb-3 overflow-auto rounded bg-red-100 p-2 text-xs text-red-800">
          {errorInfo.details}
        </pre>
      )}

      {errorInfo.stack && (
        <details className="text-xs">
          <summary className="cursor-pointer text-red-600 hover:text-red-800">
            堆栈跟踪
          </summary>
          <pre className="mt-2 overflow-auto rounded bg-red-100 p-2 text-red-800">
            {errorInfo.stack}
          </pre>
        </details>
      )}
    </div>
  );
}
