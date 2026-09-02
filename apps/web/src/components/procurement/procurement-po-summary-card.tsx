"use client";

import { useState } from "react";
import { ChevronRight, ShoppingCart } from "lucide-react";

import { ProcurementPoSummaryDialog } from "@/components/procurement/procurement-po-summary-dialog";
import { cn } from "@/lib/utils";
import {
  PO_OVERVIEW_BUCKET_LABELS,
  type PoBucketCounts,
  type PoOverviewBucket,
} from "@/utils/procurement-po-buckets";
import type { ProcOrder } from "@/services/procurement-service";

const BUCKET_ORDER: PoOverviewBucket[] = ["open", "partial", "close", "draft"];

export function ProcurementPoSummaryCard({
  loading,
  counts,
  orders,
  onExportError,
}: {
  loading: boolean;
  counts: PoBucketCounts;
  orders: ProcOrder[];
  onExportError?: (message: string | null) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className={cn(
          "flex h-full min-h-[11rem] w-full cursor-pointer flex-col rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm",
          "transition-[box-shadow,border-color] duration-200 hover:border-primary/20 hover:shadow-md",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Purchase orders
          </p>
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <ShoppingCart className="size-3.5" aria-hidden />
          </span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {BUCKET_ORDER.map((bucket) => (
            <li key={bucket} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-normal text-muted-foreground">
                {PO_OVERVIEW_BUCKET_LABELS[bucket]}
              </span>
              <span className="font-mono text-sm font-normal tabular-nums text-foreground">
                {loading ? "—" : String(counts[bucket])}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-1 text-[11px] font-normal text-[#0369A1]">
          View breakdown &amp; export
          <ChevronRight className="size-3.5" aria-hidden />
        </p>
      </button>

      <ProcurementPoSummaryDialog
        open={dialogOpen}
        loading={loading}
        counts={counts}
        orders={orders}
        onClose={() => setDialogOpen(false)}
        onExportError={onExportError}
      />
    </>
  );
}
