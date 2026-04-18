export function parseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || "An unknown error occurred";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    try {
      const obj = error as Record<string, unknown>;
      return (
        obj.message?.toString() ??
        obj.error?.toString() ??
        JSON.stringify(error)
      );
    } catch {
      return "[无法序列化的错误对象]";
    }
  }

  return String(error);
}
