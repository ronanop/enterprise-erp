"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, ExternalLink } from "lucide-react";

import { ProcurementOpenOvfDialog } from "@/components/procurement/procurement-open-ovf-dialog";
import { cn } from "@/lib/utils";
import { formatInr, type ScmQueueItem } from "@/services/procurement-service";
import { isScmOpenOvfRow } from "@/utils/scm-queue-ovf-status";

/** Keep the KPI card compact — top amount OVFs only. */
const PREVIEW_ROWS = 4;

function customerWithGst(row: ScmQueueItem): number {
  const withTax = Number(row.customer_total_with_tax);
  if (withTax > 0) return withTax;
  return Number(row.customer_total) || 0;
}

function ovfLinkTitle(row: ScmQueueItem): string {
  const po =
    row.po_number?.trim() ||
    row.company_po_number?.trim() ||
    row.purchase_order_number?.trim();
  const ovf = row.ovf_no?.trim() || "OVF";
  return po ? `Open ${ovf} (PO ${po})` : `Open ${ovf}`;
}

function sortByAmountDesc(rows: ScmQueueItem[]): ScmQueueItem[] {
  return [...rows].sort((a, b) => customerWithGst(b) - customerWithGst(a));
}

export function ProcurementOpenOvfCard({
  loading,
  queue,
}: {
  loading: boolean;
  queue: ScmQueueItem[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const openRows = useMemo(
    () => sortByAmountDesc(queue.filter(isScmOpenOvfRow)),
    [queue],
  );
  const count = openRows.length;
  const preview = openRows.slice(0, PREVIEW_ROWS);
  const moreCount = count - preview.length;
  const tone =
    count > 0 ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800";

  return (
    <>
      <div
        className={cn(
          "flex h-full min-h-[11rem] flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-sm",
          "transition-[box-shadow,border-color] duration-200 hover:border-primary/20 hover:shadow-md",
        )}
      >
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="flex w-full cursor-pointer items-start justify-between gap-2 rounded-md text-left outline-none transition-opacity duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <p className="text-sm font-semibold tracking-tight text-foreground">
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
        </button>

        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="mt-2 block w-full cursor-pointer text-left font-mono text-xl font-semibold tracking-tight text-foreground tabular-nums outline-none transition-opacity duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {loading ? "—" : String(count)}
        </button>

        {loading ? (
          <p className="mt-3 text-xs font-normal text-muted-foreground">Loading…</p>
        ) : count === 0 ? (
          <p className="mt-3 text-xs font-normal text-muted-foreground">
            No open OVFs right now.
          </p>
        ) : (
          <div className="mt-3 min-w-0 space-y-2">
            <div className="grid grid-cols-3 gap-x-4 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
              <span className="min-w-0 truncate">Customer</span>
              <span className="min-w-0 text-center">Amount</span>
              <span className="min-w-0 text-right">Link</span>
            </div>
            <ul className="space-y-1.5">
              {preview.map((row) => (
                <li
                  key={row.ovf_id}
                  className="grid grid-cols-3 gap-x-4 items-center text-xs"
                >
                  <span className="min-w-0 truncate font-normal text-foreground">
                    {row.customer_name?.trim() || row.ovf_no || "—"}
                  </span>
                  <span className="min-w-0 text-center font-mono font-normal tabular-nums text-foreground">
                    {formatInr(customerWithGst(row))}
                  </span>
                  <span className="flex min-w-0 justify-end">
                    <Link
                      href={`/procurement/scm/ovf/${row.ovf_id}`}
                      className={cn(
                        "inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-primary",
                        "transition-colors duration-200 hover:bg-primary/10 hover:text-primary/80",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                      )}
                      title={ovfLinkTitle(row)}
                      aria-label={ovfLinkTitle(row)}
                    >
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
            {moreCount > 0 ? (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="cursor-pointer text-[11px] font-normal text-muted-foreground transition-colors duration-200 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              >
                +{moreCount} more
              </button>
            ) : null}
          </div>
        )}
      </div>

      <ProcurementOpenOvfDialog
        open={dialogOpen}
        rows={openRows}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
