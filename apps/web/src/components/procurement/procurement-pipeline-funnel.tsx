"use client";

import { useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";

import { ProcurementPoGrnBreakdownDialog } from "@/components/procurement/procurement-po-grn-breakdown-dialog";
import { procurementPipelineStages } from "@/config/procurement";
import { cn } from "@/lib/utils";
import type { ProcurementRow, ScmVendorPo } from "@/services/procurement-service";
import {
  buildPoReceiptBreakdown,
  type ProcurementPipelineMetrics,
} from "@/utils/procurement-pipeline-metrics";

interface ProcurementPipelineFunnelProps {
  metrics: ProcurementPipelineMetrics;
  vendorPos?: Array<ProcurementRow | ScmVendorPo>;
  loading?: boolean;
}

const BAR_COLORS = [
  "bg-sky-600",
  "bg-teal-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-slate-600",
] as const;

export function ProcurementPipelineFunnel({
  metrics,
  vendorPos = [],
  loading,
}: ProcurementPipelineFunnelProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const breakdownRows = useMemo(
    () => buildPoReceiptBreakdown(vendorPos),
    [vendorPos],
  );

  const values = procurementPipelineStages.map((stage) => ({
    ...stage,
    count:
      stage.resource === "scm"
        ? metrics.scm
        : stage.resource === "orders"
          ? metrics.orders
          : metrics.grns,
  }));

  const max = Math.max(...values.map((v) => v.count), 1);

  function openBreakdown(event?: MouseEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    setBreakdownOpen(true);
  }

  return (
    <div className="h-full rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          ANALYTICS
        </h2>
      </div>

      <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {values.map((stage, index) => {
          const width =
            stage.count > 0 ? Math.round((stage.count / max) * 100) : 0;
          const opensBreakdown =
            stage.resource === "orders" || stage.resource === "grns";
          const stageTint =
            stage.resource === "scm"
              ? "border-amber-200/70 bg-amber-50/90 hover:border-amber-300/80"
              : stage.resource === "orders"
                ? "border-sky-200/70 bg-sky-50/90 hover:border-sky-300/80"
                : "border-teal-200/70 bg-teal-50/90 hover:border-teal-300/80";
          const cardClass = cn(
            "group block h-full w-full cursor-pointer rounded-xl border p-3 text-left transition-[border-color,box-shadow,background-color] duration-200 hover:shadow-sm",
            stageTint,
          );

          const body = (
            <>
              <p className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                {stage.title}
              </p>
              <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-foreground">
                {loading ? "—" : stage.count.toLocaleString("en-IN")}
              </p>
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
            </>
          );

          return (
            <li key={stage.key} className="min-w-0">
              {opensBreakdown ? (
                <button
                  type="button"
                  className={cardClass}
                  onClick={openBreakdown}
                  disabled={loading}
                >
                  {body}
                </button>
              ) : (
                <Link href={stage.href} className={cardClass}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      <ProcurementPoGrnBreakdownDialog
        open={breakdownOpen}
        rows={breakdownRows}
        onClose={() => setBreakdownOpen(false)}
      />
    </div>
  );
}
