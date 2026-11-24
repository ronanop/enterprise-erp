"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { formatInr } from "@/services/procurement-service";

export type PoMarginLineRow = {
  product_name: string;
  qty?: number | null;
  margin_amount: number;
  margin_pct: number;
};

type PoMarginReviewCardProps = {
  customerTotal: number;
  vendorTotal: number;
  marginAmount: number;
  marginPct: number;
  /** Optional product-level rows for approval review. */
  lines?: PoMarginLineRow[];
  className?: string;
  footnote?: ReactNode;
};

function money(value: number): string {
  return formatInr(Number(value) || 0);
}

function pct(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${n.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}%`;
}

/**
 * Internal margin review for Create PO / PO detail / approval.
 * Intentionally screen-only — never fed into Download PO PDF.
 */
export function PoMarginReviewCard({
  customerTotal,
  vendorTotal,
  marginAmount,
  marginPct,
  lines = [],
  className,
  footnote,
}: PoMarginReviewCardProps) {
  return (
    <section
      className={cn(
        "space-y-3 rounded-lg border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm",
        className,
      )}
    >
      <div className="space-y-1">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Margin (approval review)
        </h2>
        <p className="text-xs text-muted-foreground">
          Internal only — shown here for SCM and approvers. Not included on the PO PDF.
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0 space-y-1">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-foreground">
            Customer total
          </dt>
          <dd className="text-sm tabular-nums text-slate-700">{money(customerTotal)}</dd>
        </div>
        <div className="min-w-0 space-y-1">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-foreground">
            Vendor total
          </dt>
          <dd className="text-sm tabular-nums text-slate-700">{money(vendorTotal)}</dd>
        </div>
        <div className="min-w-0 space-y-1">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-foreground">
            Margin
          </dt>
          <dd
            className={cn(
              "text-sm font-semibold tabular-nums",
              marginAmount >= 0 ? "text-emerald-800" : "text-rose-800",
            )}
          >
            {money(marginAmount)}
          </dd>
        </div>
        <div className="min-w-0 space-y-1">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-foreground">
            Margin %
          </dt>
          <dd
            className={cn(
              "text-sm font-semibold tabular-nums",
              marginPct >= 0 ? "text-emerald-800" : "text-rose-800",
            )}
          >
            {pct(marginPct)}
          </dd>
        </div>
      </dl>

      {lines.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-border/80 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Product</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Margin</th>
                  <th className="px-3 py-2 text-right font-medium">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((row, index) => (
                  <tr
                    key={`${row.product_name}-${index}`}
                    className="border-b border-border/70"
                  >
                    <td className="px-3 py-2 font-medium">
                      {row.product_name?.trim() || "-"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {Number.isFinite(Number(row.qty)) ? Number(row.qty) : "-"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(row.margin_amount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {pct(row.margin_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {footnote ? <div className="text-xs text-muted-foreground">{footnote}</div> : null}
    </section>
  );
}
