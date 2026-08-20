"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ClipboardList, ExternalLink, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatInr, type ScmQueueItem } from "@/services/procurement-service";

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

type ProcurementOpenOvfDialogProps = {
  open: boolean;
  rows: ScmQueueItem[];
  onClose: () => void;
};

export function ProcurementOpenOvfDialog({
  open,
  rows,
  onClose,
}: ProcurementOpenOvfDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-ovf-dialog-title"
        className="flex max-h-[min(36rem,calc(100dvh-2rem))] w-full max-w-xl flex-col rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40"
              aria-hidden
            >
              <ClipboardList className="size-4 text-foreground" />
            </span>
            <div className="min-w-0">
              <h2
                id="open-ovf-dialog-title"
                className="text-sm font-semibold leading-none tracking-tight text-foreground"
              >
                Open OVF
              </h2>
              <p className="mt-1 text-xs font-normal text-muted-foreground">
                {rows.length} awaiting purchase order
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 cursor-pointer transition-colors duration-200"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto] gap-x-4 border-b border-border/60 pb-2 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
            <span>Customer</span>
            <span className="text-right">Amount</span>
            <span className="w-8 text-center">Link</span>
          </div>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm font-normal text-muted-foreground">
              No open OVFs right now.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((row) => (
                <li
                  key={row.ovf_id}
                  className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto] items-center gap-x-4 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-normal text-foreground">
                      {row.customer_name?.trim() || row.ovf_no || "—"}
                    </p>
                    <p className="truncate text-[11px] font-normal text-muted-foreground">
                      {row.ovf_no}
                      {row.po_number?.trim() ? ` · PO ${row.po_number.trim()}` : ""}
                    </p>
                  </div>
                  <span className="text-right font-mono font-normal tabular-nums text-foreground">
                    {formatInr(customerWithGst(row))}
                  </span>
                  <span className="flex w-8 justify-center">
                    <Link
                      href={`/procurement/scm/ovf/${row.ovf_id}`}
                      className={cn(
                        "inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-primary",
                        "transition-colors duration-200 hover:bg-primary/10 hover:text-primary/80",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                      )}
                      title={ovfLinkTitle(row)}
                      aria-label={ovfLinkTitle(row)}
                      onClick={onClose}
                    >
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border/60 px-5 py-3">
          <Link
            href="/procurement/scm?filter=open"
            onClick={onClose}
            className="inline-flex cursor-pointer text-xs font-normal text-[#0369A1] transition-opacity duration-200 hover:opacity-80"
          >
            Open SCM queue →
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
