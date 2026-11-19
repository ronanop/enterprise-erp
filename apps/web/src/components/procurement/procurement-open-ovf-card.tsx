"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatInr, type ScmQueueItem } from "@/services/procurement-service";
import { isScmOpenOvfRow } from "@/utils/scm-queue-ovf-status";

const MAX_ROWS = 5;

function formatEdd(row: ScmQueueItem): string {
  const fromPo = row.expected_delivery_date?.trim();
  if (fromPo) {
    const d = new Date(fromPo);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    return fromPo.slice(0, 10);
  }
  const period = row.delivery_period?.trim();
  if (!period) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(period)) {
    const d = new Date(period.slice(0, 10));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }
  return period;
}

function customerWithGst(row: ScmQueueItem): number {
  const withTax = Number(row.customer_total_with_tax);
  if (withTax > 0) return withTax;
  return Number(row.customer_total) || 0;
}

export function ProcurementOpenOvfCard({
  loading,
  queue,
}: {
  loading: boolean;
  queue: ScmQueueItem[];
}) {
  const openRows = queue.filter(isScmOpenOvfRow);
  const count = openRows.length;
  const tone =
    count > 0 ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800";

  return (
    <Link
      href="/procurement/scm?filter=open"
      className={cn(
        "flex h-full min-h-[11rem] cursor-pointer flex-col rounded-xl border border-border/80 bg-card p-3.5 shadow-sm",
        "transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Open OVF
        </p>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            tone,
          )}
        >
          <ClipboardList className="size-3.5" aria-hidden />
        </span>
      </div>

      <p className="mt-2 font-mono text-xl font-medium tracking-tight text-foreground tabular-nums">
        {loading ? "—" : String(count)}
      </p>

      {loading ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading…</p>
      ) : count === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No open OVFs right now.</p>
      ) : (
        <div className="mt-3 min-w-0 space-y-2">
          <div
            className="grid grid-cols-3 gap-x-4 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            <span className="min-w-0 truncate">Customer</span>
            <span className="min-w-0 text-center">Amount</span>
            <span className="min-w-0 text-right">EDD</span>
          </div>
          <ul className="space-y-1.5">
            {openRows.slice(0, MAX_ROWS).map((row) => (
              <li
                key={row.ovf_id}
                className="grid grid-cols-3 gap-x-4 items-center text-xs"
              >
                <span className="min-w-0 truncate font-medium text-foreground">
                  {row.customer_name?.trim() || row.ovf_no || "—"}
                </span>
                <span className="min-w-0 text-center font-mono tabular-nums text-foreground">
                  {formatInr(customerWithGst(row))}
                </span>
                <span className="min-w-0 text-right tabular-nums text-muted-foreground">
                  {formatEdd(row)}
                </span>
              </li>
            ))}
          </ul>
          {count > MAX_ROWS ? (
            <p className="text-[11px] text-muted-foreground">
              +{count - MAX_ROWS} more in SCM queue
            </p>
          ) : null}
        </div>
      )}
    </Link>
  );
}
