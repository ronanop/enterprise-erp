"use client";

import Link from "next/link";
import { Boxes } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProcurementInventoryStockSummary } from "@/utils/procurement-inventory-report";

export function ProcurementInventoryStockCard({
  loading,
  summary,
}: {
  loading: boolean;
  summary: ProcurementInventoryStockSummary | null;
}) {
  const totalUnits = summary?.totalUnits ?? 0;
  const tone =
    totalUnits > 0 ? "bg-emerald-100 text-emerald-800" : "bg-accent text-accent-foreground";

  return (
    <Link
      href="/procurement/inventory"
      className={cn(
        "flex h-full min-h-[11rem] cursor-pointer flex-col rounded-xl border border-border/80 bg-card p-3.5 shadow-sm",
        "transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
          Inventory / stock
        </p>
        <span
          className={cn("flex size-8 items-center justify-center rounded-lg", tone)}
        >
          <Boxes className="size-3.5" aria-hidden />
        </span>
      </div>

      <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className="text-xs font-normal text-muted-foreground">
          Total inventory available
        </p>
        <p className="font-mono text-xl font-semibold tracking-tight text-foreground tabular-nums">
          {loading ? "—" : String(totalUnits)}
        </p>
      </div>
      {loading ? (
        <p className="mt-2 text-xs font-normal text-muted-foreground">Loading…</p>
      ) : totalUnits === 0 ? (
        <p className="mt-2 text-xs font-normal text-muted-foreground">No GRN stock on hand.</p>
      ) : null}
    </Link>
  );
}
