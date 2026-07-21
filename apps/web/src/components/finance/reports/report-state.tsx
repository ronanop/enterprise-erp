"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type Props = {
  error: string | null;
  onRetry: () => void;
  authenticated?: boolean;
};

export function ReportErrorState({ error, onRetry, authenticated = true }: Props) {
  if (!error) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <span>{error}</span>
      <div className="flex gap-2">
        {!authenticated ? (
          <Link
            href="/login"
            className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            Sign in
          </Link>
        ) : null}
        <Button type="button" size="sm" variant="outline" className="h-8 cursor-pointer" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}

export function ReportTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-xl border border-border/80 bg-card p-3 shadow-sm">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded bg-muted/70" />
      ))}
    </div>
  );
}

export function ReportEmptyState({ message = "No data for the selected filters." }: { message?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
