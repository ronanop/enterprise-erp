"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileDown, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  listOrderReceiptBatches,
  type ScmReceiptBatch,
} from "@/services/procurement-service";
import {
  downloadBatchGrnPdf,
  type GrnReceiptPdfContext,
} from "@/utils/grn-batch-pdf-download";
import {
  formatPipelineQty,
  type PoReceiptBreakdownRow,
  type PoReceiptStatus,
} from "@/utils/procurement-pipeline-metrics";

const STATUS_META: Record<
  PoReceiptStatus,
  { label: string; chip: string }
> = {
  awaiting: {
    label: "Awaiting",
    chip: "bg-slate-100 text-slate-800",
  },
  partial: {
    label: "Partial",
    chip: "bg-amber-100 text-amber-950",
  },
  complete: {
    label: "Complete",
    chip: "bg-emerald-100 text-emerald-900",
  },
};

const PIE_COLOR = {
  received: "#0369A1",
  remaining: "#F59E0B",
  track: "#E2E8F0",
} as const;

type ProcurementPoGrnBreakdownDialogProps = {
  open: boolean;
  rows: PoReceiptBreakdownRow[];
  onClose: () => void;
};

function formatReceiptAt(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSerials(serials: string[] | null | undefined): string {
  if (!serials?.length) return "—";
  return serials.join(", ");
}

function batchUnitsReceived(batch: ScmReceiptBatch): number {
  return (batch.lines || []).reduce((sum, ln) => sum + (Number(ln.quantity) || 0), 0);
}

/** Flat donut — correctly draws 0% and 100% (exploded 3D pie breaks on full arcs). */
function PoCompletionDonut({
  row,
}: {
  row: PoReceiptBreakdownRow;
}) {
  const ordered = Math.max(0, row.qtyOrdered);
  const received = Math.max(0, Math.min(ordered || row.qtyReceived, row.qtyReceived));
  const remaining = Math.max(0, ordered - received);

  let pct =
    ordered > 0
      ? Math.min(100, Math.round((received / ordered) * 1000) / 10)
      : row.status === "complete"
        ? 100
        : row.status === "partial"
          ? 50
          : 0;

  if (row.status === "complete" && pct < 100 && ordered <= 0) pct = 100;

  const size = 112;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const receivedLen = (pct / 100) * c;
  const remainingLen = c - receivedLen;

  return (
    <div className="flex min-w-0 flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${row.poNumber} receipt ${pct}% complete`}
          className="block -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={PIE_COLOR.track}
            strokeWidth={stroke}
          />
          {pct < 100 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={PIE_COLOR.remaining}
              strokeWidth={stroke}
              strokeDasharray={`${remainingLen} ${c}`}
              strokeDashoffset={-receivedLen}
              strokeLinecap="butt"
            />
          ) : null}
          {pct > 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={PIE_COLOR.received}
              strokeWidth={stroke}
              strokeDasharray={`${receivedLen} ${c}`}
              strokeLinecap="butt"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-mono text-lg font-bold tabular-nums text-foreground">
            {pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            received
          </p>
        </div>
      </div>

      <ul className="w-full space-y-1 text-[11px]" aria-label="Qty breakdown">
        <li className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: PIE_COLOR.received }}
              aria-hidden
            />
            <span className="text-foreground">Received</span>
          </span>
          <span className="tabular-nums text-muted-foreground">
            {formatPipelineQty(received)}
            {ordered > 0 ? ` · ${pct}%` : ""}
          </span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: PIE_COLOR.remaining }}
              aria-hidden
            />
            <span className="text-foreground">Remaining</span>
          </span>
          <span className="tabular-nums text-muted-foreground">
            {formatPipelineQty(remaining)}
            {ordered > 0 ? ` · ${Math.max(0, Math.round((100 - pct) * 10) / 10)}%` : ""}
          </span>
        </li>
      </ul>
    </div>
  );
}

function PoCompletionCard({
  row,
  onSelect,
}: {
  row: PoReceiptBreakdownRow;
  onSelect: (row: PoReceiptBreakdownRow) => void;
}) {
  const meta = STATUS_META[row.status];

  return (
    <button
      type="button"
      className="w-full cursor-pointer rounded-xl border border-border/60 bg-muted/10 p-3.5 text-left shadow-sm transition-[border-color,box-shadow,background-color] duration-200 hover:border-[#0369A1]/40 hover:bg-card hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0369A1]/40"
      onClick={() => onSelect(row)}
      aria-label={`View GRNs for ${row.poNumber}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold tabular-nums text-[#0369A1]">{row.poNumber}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {row.grnCount}
            </span>{" "}
            GRN{row.grnCount === 1 ? "" : "s"}
            <span className="mx-1 text-border">·</span>
            {formatPipelineQty(row.qtyReceived)}/
            {formatPipelineQty(row.qtyOrdered)} qty
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            meta.chip,
          )}
        >
          {meta.label}
        </span>
      </div>

      <PoCompletionDonut row={row} />
    </button>
  );
}

function batchPdfKey(batch: ScmReceiptBatch): string {
  return `${batch.sequence}:${batch.grn_number}`;
}

function PoGrnDetailPanel({
  row,
}: {
  row: PoReceiptBreakdownRow;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batches, setBatches] = useState<ScmReceiptBatch[]>([]);
  const [pdfBusyKey, setPdfBusyKey] = useState<string | null>(null);

  const pdfContext = useMemo((): GrnReceiptPdfContext => {
    return {
      poNumber: row.poNumber,
      documentDate: new Date().toISOString().slice(0, 10),
      vendorAddressLines: [],
    };
  }, [row.poNumber]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBatches([]);
    void (async () => {
      try {
        const list = await listOrderReceiptBatches(row.id);
        if (!cancelled) {
          setBatches([...list].sort((a, b) => a.sequence - b.sequence));
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err, "Failed to load GRNs for this PO"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row.id]);

  const meta = STATUS_META[row.status];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            meta.chip,
          )}
        >
          {meta.label}
        </span>
        <p className="text-xs text-muted-foreground">
          {row.grnCount} GRN{row.grnCount === 1 ? "" : "s"}
          <span className="mx-1.5 text-border">·</span>
          {formatPipelineQty(row.qtyReceived)}/{formatPipelineQty(row.qtyOrdered)} qty received
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading GRNs…</p>
      ) : null}

      {!loading && !error && batches.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No GRN batches recorded for this PO yet.
        </p>
      ) : null}

      {!loading && batches.length > 0 ? (
        <div className="space-y-3">
          {batches.map((batch) => {
            const units = batchUnitsReceived(batch);
            const hasLines = (batch.lines?.length ?? 0) > 0;
            const busy = pdfBusyKey === batchPdfKey(batch);
            return (
              <section
                key={`${batch.sequence}-${batch.grn_number}`}
                className="overflow-hidden rounded-xl border border-border/70 bg-muted/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-card px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      <span className="font-medium text-muted-foreground">GRN: </span>
                      {batch.grn_number}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatReceiptAt(batch.receipt_at)}
                      <span className="mx-1.5 text-border">·</span>
                      <span className="font-mono font-semibold tabular-nums text-foreground">
                        {units}
                      </span>{" "}
                      unit{units === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 shrink-0 cursor-pointer border-border p-0 text-[#0369A1] transition-colors duration-200 hover:bg-sky-50 hover:text-[#0369A1]"
                    disabled={!hasLines || busy}
                    title={
                      hasLines
                        ? `Download GRN PDF for ${batch.grn_number}`
                        : "No line detail for PDF"
                    }
                    aria-label={`Download GRN PDF for ${batch.grn_number}`}
                    onClick={() => {
                      const key = batchPdfKey(batch);
                      setPdfBusyKey(key);
                      setError(null);
                      void downloadBatchGrnPdf(batch, {
                        ...pdfContext,
                        documentDate:
                          batch.receipt_at?.trim() || pdfContext.documentDate,
                      })
                        .catch((err) =>
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Failed to download GRN PDF",
                          ),
                        )
                        .finally(() => setPdfBusyKey(null));
                    }}
                  >
                    <FileDown className="size-4 stroke-[2]" />
                  </Button>
                </div>

                <div className="px-3.5 py-3">
                  {hasLines ? (
                    <div className="overflow-x-auto rounded-lg border border-border/60">
                      <table className="w-full min-w-[480px] text-left text-xs">
                        <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                          <tr>
                            <th className="px-2.5 py-2 font-semibold">#</th>
                            <th className="px-2.5 py-2 font-semibold">Product</th>
                            <th className="px-2.5 py-2 font-semibold tabular-nums">Qty</th>
                            <th className="px-2.5 py-2 font-semibold tabular-nums">Billing</th>
                            <th className="px-2.5 py-2 font-semibold">Serial numbers</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batch.lines.map((ln) => (
                            <tr
                              key={`${batch.grn_number}-${ln.order_line_id}-${ln.line_number}`}
                              className="border-b border-border/50 last:border-0"
                            >
                              <td className="px-2.5 py-2 tabular-nums text-muted-foreground">
                                {ln.line_number}
                              </td>
                              <td className="px-2.5 py-2 text-foreground">
                                {ln.product_name || "—"}
                              </td>
                              <td className="px-2.5 py-2 font-mono tabular-nums text-foreground">
                                {ln.quantity}
                              </td>
                              <td className="px-2.5 py-2 font-mono tabular-nums text-foreground">
                                {ln.billing === false
                                  ? "0"
                                  : ln.billing_quantity != null
                                    ? ln.billing_quantity
                                    : ln.quantity}
                              </td>
                              <td className="max-w-[220px] px-2.5 py-2 text-muted-foreground">
                                <span
                                  className="line-clamp-2"
                                  title={formatSerials(ln.serial_numbers)}
                                >
                                  {formatSerials(ln.serial_numbers)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No line-level detail stored for this GRN.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function ProcurementPoGrnBreakdownDialog({
  open,
  rows,
  onClose,
}: ProcurementPoGrnBreakdownDialogProps) {
  const [selectedPo, setSelectedPo] = useState<PoReceiptBreakdownRow | null>(null);
  const [poSearch, setPoSearch] = useState("");

  const filteredRows = useMemo(() => {
    const q = poSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.poNumber.toLowerCase().includes(q));
  }, [rows, poSearch]);

  const totalGrns = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.grnCount, 0),
    [filteredRows],
  );

  useEffect(() => {
    if (!open) {
      setSelectedPo(null);
      setPoSearch("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-foreground/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="po-grn-breakdown-title"
        className={cn(
          "flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg",
          "animate-in fade-in-0 zoom-in-95 duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 px-5 py-4">
          <div className="min-w-0 flex-1">
            {selectedPo ? (
              <button
                type="button"
                className="mb-1.5 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#0369A1] transition-colors duration-200 hover:underline"
                onClick={() => setSelectedPo(null)}
              >
                <ArrowLeft className="size-3.5" aria-hidden />
                All POs
              </button>
            ) : null}
            <h2
              id="po-grn-breakdown-title"
              className="text-base font-semibold tracking-tight text-foreground"
            >
              {selectedPo ? selectedPo.poNumber : "PO receipt completion"}
            </h2>
            {!selectedPo ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Click a PO to see its GRNs and items
                <span className="mx-1.5 text-border">·</span>
                {filteredRows.length.toLocaleString("en-IN")}
                {poSearch.trim() ? ` of ${rows.length.toLocaleString("en-IN")}` : ""} PO
                {filteredRows.length === 1 ? "" : "s"}
                <span className="mx-1.5 text-border">·</span>
                {totalGrns.toLocaleString("en-IN")} GRN
                {totalGrns === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!selectedPo ? (
              <div className="relative w-[min(100%,14rem)] sm:w-56">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={poSearch}
                  onChange={(e) => setPoSearch(e.target.value)}
                  placeholder="Search PO number…"
                  aria-label="Search by PO number"
                  className="h-8 cursor-text border-border bg-background pl-8 text-xs transition-colors duration-200"
                />
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0 cursor-pointer border-border bg-background transition-colors duration-200 hover:bg-muted"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {selectedPo ? (
            <PoGrnDetailPanel row={selectedPo} />
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No issued purchase orders.
            </p>
          ) : filteredRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No PO matches “{poSearch.trim()}”.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRows.map((row) => (
                <PoCompletionCard key={row.id} row={row} onSelect={setSelectedPo} />
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border/80 px-5 py-3">
          {selectedPo ? (
            <Link
              href={`/procurement/orders/${selectedPo.id}?tab=grn`}
              className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-primary px-3 text-[0.8rem] font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/80"
              onClick={onClose}
            >
              Open PO GRN tab
            </Link>
          ) : (
            <Link
              href="/procurement/orders"
              className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-primary px-3 text-[0.8rem] font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/80"
              onClick={onClose}
            >
              Open purchase orders
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
