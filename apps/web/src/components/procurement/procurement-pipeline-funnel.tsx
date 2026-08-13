import Link from "next/link";

import { procurementPipelineStages } from "@/config/procurement";
import { cn } from "@/lib/utils";
import {
  formatPipelineQty,
  type ProcurementPipelineMetrics,
} from "@/utils/procurement-pipeline-metrics";

interface ProcurementPipelineFunnelProps {
  metrics: ProcurementPipelineMetrics;
  loading?: boolean;
}

const BAR_COLORS = [
  "bg-sky-600",
  "bg-teal-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-slate-600",
] as const;

function stageHint(
  resource: string,
  metrics: ProcurementPipelineMetrics,
): string | null {
  if (resource === "grns") {
    if (metrics.grns <= 0) return "No receipts yet";
    const avg =
      metrics.avgGrnsPerPo > 0
        ? ` · avg ${metrics.avgGrnsPerPo.toLocaleString("en-IN")} / PO`
        : "";
    return `${metrics.posWithGrn.toLocaleString("en-IN")} PO${metrics.posWithGrn === 1 ? "" : "s"} with GRN${avg}`;
  }
  if (resource === "orders") {
    if (metrics.orders <= 0) return "Issued vendor POs";
    return `${metrics.posComplete.toLocaleString("en-IN")} fully received`;
  }
  return null;
}

export function ProcurementPipelineFunnel({
  metrics,
  loading,
}: ProcurementPipelineFunnelProps) {
  const values = procurementPipelineStages.map((stage) => ({
    ...stage,
    count:
      stage.resource === "scm"
        ? metrics.scm
        : stage.resource === "orders"
          ? metrics.orders
          : stage.resource === "grns"
            ? metrics.grns
            : stage.resource === "delivery-challan"
              ? metrics["delivery-challan"]
              : metrics["delivery-status"],
  }));

  const max = Math.max(...values.map((v) => v.count), 1);
  const receiptPctWidth = Math.max(0, Math.min(100, metrics.receiptPct));

  return (
    <div className="h-full rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Analytics
        </h2>
        <p className="mt-0.5 text-xs font-normal text-muted-foreground">
          Pipeline volume — GRN counts documents (one PO can have many GRNs)
        </p>
      </div>

      <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {values.map((stage, index) => {
          const width =
            stage.count > 0 ? Math.round((stage.count / max) * 100) : 0;
          const hint = stageHint(stage.resource, metrics);
          return (
            <li key={stage.key} className="min-w-0">
              <Link
                href={stage.href}
                className="group block h-full cursor-pointer rounded-xl border border-border/50 bg-muted/30 p-3 transition-[border-color,box-shadow,background-color] duration-200 hover:border-primary/20 hover:bg-card hover:shadow-sm"
              >
                <p className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                  {stage.title}
                </p>
                <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-foreground">
                  {loading ? "—" : stage.count.toLocaleString("en-IN")}
                </p>
                {!loading && hint ? (
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                    {hint}
                  </p>
                ) : null}
                {!loading ? (
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    {stage.count > 0 ? (
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-300",
                          BAR_COLORS[index % BAR_COLORS.length],
                        )}
                        style={{ width: `${width}%` }}
                        role="presentation"
                      />
                    ) : null}
                  </div>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 rounded-xl border border-border/50 bg-muted/20 px-3.5 py-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              PO receipt progress
            </p>
            <p className="mt-1 text-sm text-foreground">
              {loading ? (
                "—"
              ) : (
                <>
                  <span className="font-medium tabular-nums">
                    {metrics.posAwaitingGrn.toLocaleString("en-IN")}
                  </span>{" "}
                  awaiting
                  <span className="mx-1.5 text-border">·</span>
                  <span className="font-medium tabular-nums">
                    {metrics.posPartial.toLocaleString("en-IN")}
                  </span>{" "}
                  partial
                  <span className="mx-1.5 text-border">·</span>
                  <span className="font-medium tabular-nums">
                    {metrics.posComplete.toLocaleString("en-IN")}
                  </span>{" "}
                  complete
                </>
              )}
            </p>
          </div>
          <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
            {loading ? "—" : `${metrics.receiptPct}% qty received`}
          </p>
        </div>

        {!loading ? (
          <>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
                style={{ width: `${receiptPctWidth}%` }}
                role="presentation"
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {formatPipelineQty(metrics.qtyReceived)} of{" "}
              {formatPipelineQty(metrics.qtyOrdered)} units received across issued
              POs
              {metrics.grns > 0
                ? ` · ${metrics.grns.toLocaleString("en-IN")} GRN document${metrics.grns === 1 ? "" : "s"}`
                : ""}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
