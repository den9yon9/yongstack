import type { ReactNode } from "react";

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = "" }: TableProps) {
  return (
    <div
      className={`overflow-x-auto rounded-lg border border-border ${className}`}
    >
      <table className="min-w-full divide-y divide-border text-sm">
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-surface-hover">{children}</thead>;
}

export function THeadRow({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>;
}

export function TH({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary ${className}`}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return (
    <tbody className="divide-y divide-border bg-surface">{children}</tbody>
  );
}

export function TBodyRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr className={`transition-colors hover:bg-surface-hover ${className}`}>
      {children}
    </tr>
  );
}

interface TDProps {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}

export function TD({ children, className = "", colSpan }: TDProps) {
  return (
    <td
      colSpan={colSpan}
      className={`whitespace-nowrap px-4 py-3 text-text ${className}`}
    >
      {children}
    </td>
  );
}
