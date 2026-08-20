"use client";

import { HeartPulse } from "lucide-react";

import type { AssetOperationsKpiModel } from "@/components/assets/dashboard.mapper";
import { StatCardSkeleton } from "@/components/assets/shared";
import { cn } from "@/lib/utils";

export type OperationsHealthSummaryProps = {
  kpis?: AssetOperationsKpiModel | null;
  loading?: boolean;
  className?: string;
};

function formatValue(n: number | undefined): string {
  if (n === undefined) return "—";
  return String(n);
}

/** Compact health strip derived from existing dashboard KPIs (no backend math). */
export function OperationsHealthSummary({
  kpis,
  loading,
  className,
}: OperationsHealthSummaryProps) {
  if (loading) {
    return (
      <div
        className={cn("grid grid-cols-2 gap-2 sm:grid-cols-5", className)}
        data-testid="asset-ops-health-summary"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <StatCardSkeleton key={i} className="min-h-[72px]" />
        ))}
      </div>
    );
  }

  const cells = [
    { label: "Healthy Assets", value: kpis?.readyToMove, testId: "health-healthy" },
    { label: "Assigned", value: kpis?.assigned, testId: "health-assigned" },
    { label: "Pending Disposal", value: kpis?.pendingDisposal, testId: "health-pending-disposal" },
    { label: "Retired", value: kpis?.retired, testId: "health-retired" },
    { label: "Disposed", value: kpis?.disposed, testId: "health-disposed" },
  ];

  return (
    <section
      aria-labelledby="asset-ops-health-heading"
      className={cn("space-y-2", className)}
      data-testid="asset-ops-health-summary"
    >
      <div className="flex items-center gap-2">
        <HeartPulse className="size-4 text-muted-foreground" aria-hidden />
        <h2 id="asset-ops-health-heading" className="text-sm font-medium tracking-tight">
          Asset Health
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className="rounded-md border border-border/70 bg-card px-3 py-2 shadow-sm transition-colors duration-200"
            data-testid={cell.testId}
          >
            <p className="text-[11px] font-medium text-muted-foreground">{cell.label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {kpis ? formatValue(cell.value) : "—"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
