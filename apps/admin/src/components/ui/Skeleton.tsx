interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-border ${className}`}
      role="status"
      aria-label="加载中"
    />
  );
}

const skeletonIds = Array.from({ length: 20 }, (_, i) => `sk-${i}`);

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {skeletonIds.slice(0, rows).map((id) => (
        <div key={id} className="flex gap-4">
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <Skeleton className="mb-2 h-4 w-1/2" />
      <Skeleton className="h-8 w-1/3" />
    </div>
  );
}
