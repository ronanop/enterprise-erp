"use client";

import { useMemo } from "react";
import { BarChart3, Package, PackageCheck, Receipt, Warehouse } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  buildPoFulfillmentMetrics,
  formatPoQty,
  type PoFulfillmentBatchInput,
  type PoFulfillmentLineInput,
} from "@/utils/po-fulfillment-metrics";

type PoFulfillmentChartsProps = {
  /** Company PO / document number — scopes the panel to the open order only. */
  poLabel: string;
  lines: PoFulfillmentLineInput[];
  batches?: PoFulfillmentBatchInput[];
  loading?: boolean;
  className?: string;
};

function StatChip({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Package;
  tone: "sky" | "amber" | "emerald" | "teal" | "slate";
}) {
  const toneClass =
    tone === "sky"
      ? "border-sky-200/80 bg-gradient-to-br from-sky-50 via-sky-50/70 to-white text-sky-950"
      : tone === "amber"
        ? "border-amber-200/80 bg-gradient-to-br from-amber-50 via-amber-50/70 to-white text-amber-950"
        : tone === "emerald"
          ? "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-emerald-50/70 to-white text-emerald-950"
          : tone === "teal"
            ? "border-teal-200/80 bg-gradient-to-br from-teal-50 via-teal-50/70 to-white text-teal-950"
            : "border-slate-200/80 bg-gradient-to-br from-slate-50 via-slate-50/70 to-white text-slate-950";
  const iconClass =
    tone === "sky"
      ? "bg-sky-100 text-sky-800"
      : tone === "amber"
        ? "bg-amber-100 text-amber-800"
        : tone === "emerald"
          ? "bg-emerald-100 text-emerald-800"
          : tone === "teal"
            ? "bg-teal-100 text-teal-800"
            : "bg-slate-200/80 text-slate-800";

  return (
    <div
      className={cn(
        "flex min-h-[4.5rem] items-start gap-2.5 rounded-xl border px-3 py-3 shadow-sm",
        "transition-[box-shadow] duration-200",
        toneClass,
      )}
    >
      <span
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
          iconClass,
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums leading-tight">{value}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

export function PoFulfillmentCharts({
  poLabel,
  lines,
  batches = [],
  loading,
  className,
}: PoFulfillmentChartsProps) {
  const metrics = useMemo(
    () => buildPoFulfillmentMetrics(lines, batches),
    [lines, batches],
  );

  if (loading) {
    return (
      <section
        className={cn(
          "space-y-3 rounded-lg border-2 border-foreground/20 bg-card p-4 shadow-sm",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">Loading fulfillment for this PO…</p>
      </section>
    );
  }

  if (metrics.lineCount === 0 && metrics.orderedQty <= 0) {
    return null;
  }

  const titlePo = poLabel.trim() || "This purchase order";

  return (
    <section
      className={cn(
        "space-y-4 rounded-lg border-2 border-sky-200/50 bg-gradient-to-br from-sky-50/50 via-card to-teal-50/30 p-4 shadow-sm",
        className,
      )}
      aria-label={`Fulfillment for ${titlePo}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-sky-200/80 bg-sky-100 text-sky-800">
            <BarChart3 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
              Fulfillment for {titlePo}
            </h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-5">
        <StatChip
          label="Ordered"
          value={formatPoQty(metrics.orderedQty)}
          icon={Package}
          tone="slate"
        />
        <StatChip
          label="Received"
          value={formatPoQty(metrics.receivedQty)}
          icon={PackageCheck}
          tone="sky"
        />
        <StatChip
          label="Pending GRN"
          value={formatPoQty(metrics.remainingQty)}
          icon={Package}
          tone="amber"
        />
        <StatChip
          label="Billed"
          value={formatPoQty(metrics.billedQty)}
          icon={Receipt}
          tone="emerald"
        />
        <StatChip
          label="In stock"
          value={formatPoQty(metrics.unbilledQty)}
          icon={Warehouse}
          tone="teal"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-white/80">
        <div className="border-b border-border/70 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">
            Line items on {titlePo}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-b border-border/70 bg-muted/30 text-[10px] font-bold uppercase tracking-wide text-foreground">
              <tr>
                <th className="px-3 py-2.5">Product</th>
                <th className="px-3 py-2.5 text-right">Ordered</th>
                <th className="px-3 py-2.5 text-right">Received</th>
                <th className="px-3 py-2.5 text-right">Pending</th>
                <th className="px-3 py-2.5 text-right">Billed</th>
                <th className="px-3 py-2.5 text-right">Stock</th>
              </tr>
            </thead>
            <tbody>
              {metrics.lines.map((row) => (
                <tr key={row.lineId} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2.5 font-medium text-foreground">{row.productLabel}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatPoQty(row.orderedQty)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-sky-800">
                    {formatPoQty(row.receivedQty)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-800">
                    {formatPoQty(row.remainingQty)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-800">
                    {formatPoQty(row.billedQty)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-teal-800">
                    {formatPoQty(row.unbilledQty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
