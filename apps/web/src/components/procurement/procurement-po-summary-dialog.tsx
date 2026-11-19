"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { FileSpreadsheet, ShoppingCart, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  formatInr,
  listPurchaseOrders,
  listVendorOptions,
  type ProcOrder,
} from "@/services/procurement-service";
import { buildOrderExportRows, exportOrdersXlsx } from "@/utils/orders-excel-export";
import {
  deriveGrnStatus,
  filterOrdersByPoBucket,
  PO_OVERVIEW_BUCKET_LABELS,
  type PoBucketCounts,
  type PoOverviewBucket,
} from "@/utils/procurement-po-buckets";

const BUCKET_ORDER: PoOverviewBucket[] = ["open", "partial", "close", "draft"];

type ProcurementPoSummaryDialogProps = {
  open: boolean;
  loading: boolean;
  counts: PoBucketCounts;
  orders: ProcOrder[];
  onClose: () => void;
  onExportError?: (message: string | null) => void;
};

function sumBucketAmount(rows: ProcOrder[]): number {
  return rows.reduce((sum, row) => sum + (Number(row.total_amount) || 0), 0);
}

export function ProcurementPoSummaryDialog({
  open,
  loading,
  counts,
  orders,
  onClose,
  onExportError,
}: ProcurementPoSummaryDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [exportBusyBucket, setExportBusyBucket] = useState<PoOverviewBucket | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const enriched = useMemo(
    () =>
      orders.map((row) => ({
        ...row,
        grn_status: deriveGrnStatus(row),
      })),
    [orders],
  );

  const bucketRows = useMemo(() => {
    return BUCKET_ORDER.map((bucket) => ({
      bucket,
      rows: filterOrdersByPoBucket(enriched, bucket),
    }));
  }, [enriched]);

  const totalCount = useMemo(
    () => BUCKET_ORDER.reduce((sum, key) => sum + counts[key], 0),
    [counts],
  );

  async function onExportBucket(target: PoOverviewBucket) {
    const subset = filterOrdersByPoBucket(enriched, target);
    if (subset.length === 0) {
      onExportError?.(`No ${PO_OVERVIEW_BUCKET_LABELS[target]} rows to export.`);
      return;
    }
    setExportBusyBucket(target);
    onExportError?.(null);
    try {
      const vendorRows = await listVendorOptions();
      const vendors = Object.fromEntries(
        vendorRows.map((v) => [v.id, { label: v.label, address: v.address }]),
      );
      const commercial = await listPurchaseOrders({ includeCommercial: true });
      const idSet = new Set(subset.map((row) => row.id));
      const source = commercial.filter((row) => idSet.has(row.id));
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const slug = target.replace(/_/g, "-");
      const exportRows = buildOrderExportRows(source, vendors);
      await exportOrdersXlsx(`purchase-orders-${slug}-${stamp}.xlsx`, exportRows);
    } catch (err) {
      onExportError?.(
        err instanceof ApiClientError ? err.message : "Failed to export purchase orders",
      );
    } finally {
      setExportBusyBucket(null);
    }
  }

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
        aria-labelledby="po-summary-dialog-title"
        className="flex w-full max-w-lg flex-col rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40"
              aria-hidden
            >
              <ShoppingCart className="size-4 text-foreground" />
            </span>
            <h2
              id="po-summary-dialog-title"
              className="text-sm font-medium leading-none tracking-tight"
            >
              Purchase order lifecycle
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 cursor-pointer"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="border-b border-border/60 px-5 py-3">
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Total POs
            </p>
            <p className="mt-1 font-mono text-xl font-medium tabular-nums">
              {loading ? "—" : totalCount}
            </p>
          </div>
        </div>

        <ul className="space-y-2 px-5 py-4">
          {bucketRows.map(({ bucket, rows: bucketOrders }) => {
            const busy = exportBusyBucket === bucket;
            const count = counts[bucket];
            const value = sumBucketAmount(bucketOrders);
            return (
              <li
                key={bucket}
                className="rounded-lg border border-border/70 bg-background/60 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {PO_OVERVIEW_BUCKET_LABELS[bucket]}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-lg font-medium tabular-nums">
                      {loading ? "—" : count}
                    </p>
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      {loading ? "—" : formatInr(value)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 h-8 cursor-pointer text-xs"
                  disabled={loading || busy || count === 0}
                  onClick={() => void onExportBucket(bucket)}
                >
                  <FileSpreadsheet className="mr-1.5 size-3.5 text-[#0369A1]" />
                  {busy ? "Exporting…" : "Export to Excel"}
                </Button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-5 py-3">
          <p className="text-[11px] text-muted-foreground">Full list &amp; filters on Purchase Orders</p>
          <Link
            href="/procurement/orders"
            className="cursor-pointer text-xs font-medium text-[#0369A1] transition-opacity duration-200 hover:opacity-80"
            onClick={onClose}
          >
            Open PO list →
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
