import { cn } from "@/lib/utils";

function Pulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border/80 bg-card p-4 shadow-sm", className)}
      aria-busy="true"
      aria-label="Loading statistic"
    >
      <Pulse className="h-3 w-24" />
      <Pulse className="mt-4 h-8 w-16" />
      <Pulse className="mt-2 h-3 w-32" />
    </div>
  );
}

export function QueueCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border/80 bg-card p-4 shadow-sm", className)}
      aria-busy="true"
      aria-label="Loading queue"
    >
      <Pulse className="h-4 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Pulse key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

export function TableRowsSkeleton({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-label="Loading table">
      {Array.from({ length: rows }).map((_, i) => (
        <Pulse key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function FilterBarSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border/80 bg-card p-4", className)}
      aria-busy="true"
    >
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Pulse key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
