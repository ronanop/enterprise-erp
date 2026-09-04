"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, FileDown, FileText, Layers, RotateCcw, X } from "lucide-react";

import { ReverseGrnConfirmDialog } from "@/components/procurement/reverse-grn-confirm-dialog";
import { Button } from "@/components/ui/button";
import { formatApiError } from "@/services/api-client";
import {
  listOrderReceiptBatches,
  listReceiptBatchAttachments,
  openReceiptBatchAttachment,
  reverseReceiptBatch,
  type ReceiptBatchAttachment,
  type ScmReceiptBatch,
} from "@/services/procurement-service";
import {
  downloadBatchGrnPdf,
  type GrnReceiptPdfContext,
} from "@/utils/grn-batch-pdf-download";

export type { GrnReceiptPdfContext } from "@/utils/grn-batch-pdf-download";

type BatchSection = {
  batch: ScmReceiptBatch;
  attachments: ReceiptBatchAttachment[];
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

function batchUnitsReceived(batch: ScmReceiptBatch): number {
  return (batch.lines || []).reduce((sum, ln) => sum + (Number(ln.quantity) || 0), 0);
}

function formatSerials(serials: string[] | null | undefined): string {
  if (!serials?.length) return "—";
  return serials.join(", ");
}

function formatInvoiceDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

function batchHasVendorInvoice(batch: ScmReceiptBatch): boolean {
  return Boolean(
    batch.vendor_invoice_number?.trim() ||
      batch.vendor_invoice_date ||
      batch.vendor_invoice_quantity != null ||
      batch.vendor_invoice_subtotal != null,
  );
}

function isBatchReversed(batch: ScmReceiptBatch): boolean {
  return Boolean(batch.reversed) || (batch.reversal_status || "").toLowerCase() === "reversed";
}

type GrnReceiptHistoryDialogProps = {
  open: boolean;
  orderId: string;
  poLabel: string;
  vendorLabel?: string;
  pdfContext: GrnReceiptPdfContext;
  canReverse?: boolean;
  onClose: () => void;
  onReversed?: () => void;
};

function batchPdfKey(batch: ScmReceiptBatch): string {
  return `${batch.sequence}:${batch.grn_number}`;
}

export function GrnReceiptHistoryDialog({
  open,
  orderId,
  poLabel,
  vendorLabel,
  pdfContext,
  canReverse = true,
  onClose,
  onReversed,
}: GrnReceiptHistoryDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sections, setSections] = useState<BatchSection[]>([]);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [pdfBusyKey, setPdfBusyKey] = useState<string | null>(null);
  const [reverseTarget, setReverseTarget] = useState<ScmReceiptBatch | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);

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

  useEffect(() => {
    if (!open || !orderId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setSections([]);
    setReverseTarget(null);
    setReverseReason("");
    void (async () => {
      try {
        const batches = await listOrderReceiptBatches(orderId);
        const sorted = [...batches].sort((a, b) => b.sequence - a.sequence);
        const loaded = await Promise.all(
          sorted.map(async (batch) => {
            const id = batch.id?.trim();
            const attachments =
              id != null && id.length > 0
                ? await listReceiptBatchAttachments(id).catch(() => [])
                : [];
            return { batch, attachments };
          }),
        );
        if (!cancelled) setSections(loaded);
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err, "Failed to load GRN history"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  if (!open || !mounted) return null;

  const busy = reversing || pdfBusyKey !== null;

  async function reloadSections() {
    const batches = await listOrderReceiptBatches(orderId);
    const sorted = [...batches].sort((a, b) => b.sequence - a.sequence);
    const loaded = await Promise.all(
      sorted.map(async (batch) => {
        const id = batch.id?.trim();
        const attachments =
          id != null && id.length > 0
            ? await listReceiptBatchAttachments(id).catch(() => [])
            : [];
        return { batch, attachments };
      }),
    );
    setSections(loaded);
  }

  async function onConfirmReverse() {
    const batch = reverseTarget;
    const batchId = batch?.id?.trim();
    const reason = reverseReason.trim();
    if (!batch || !batchId || !reason || reversing) return;
    setReversing(true);
    setError(null);
    try {
      await reverseReceiptBatch(batchId, reason);
      setReverseTarget(null);
      setReverseReason("");
      setSuccess(`GRN ${batch.grn_number} reversed.`);
      await reloadSections();
      onReversed?.();
    } catch (err) {
      setError(formatApiError(err, "Failed to reverse GRN"));
    } finally {
      setReversing(false);
    }
  }

  return createPortal(
    <>
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/40 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="grn-history-dialog-title"
        className="flex max-h-[min(90vh,760px)] w-full max-w-4xl flex-col rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="grn-history-dialog-title"
              className="flex items-center gap-2 text-sm font-medium tracking-tight text-foreground"
            >
              <Layers className="size-4 text-[#0369A1]" aria-hidden />
              GRN receipt history
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {poLabel}
              {vendorLabel ? ` · ${vendorLabel}` : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 cursor-pointer"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-3 rounded-md border border-emerald-200/80 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              {success}
            </div>
          ) : null}

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading GRN batches…</p>
          ) : null}

          {!loading && !error && sections.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No GRN batches recorded for this PO yet.
            </p>
          ) : null}

          {!loading && sections.length > 0 ? (
            <div className="space-y-4">
              {sections.map(({ batch, attachments }) => {
                const units = batchUnitsReceived(batch);
                const hasLines = (batch.lines?.length ?? 0) > 0;
                const reversed = isBatchReversed(batch);
                return (
                  <section
                    key={`${batch.sequence}-${batch.grn_number}`}
                    className={`overflow-hidden rounded-lg border bg-muted/10 ${
                      reversed ? "border-destructive/40" : "border-border/70"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-card px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium tabular-nums text-foreground">
                          <span className="font-normal text-muted-foreground">GRN No. </span>
                          {batch.grn_number}
                          {reversed ? (
                            <span className="ml-2 rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                              Reversed
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatReceiptAt(batch.receipt_at)}
                        </p>
                        {reversed ? (
                          <p className="mt-1 text-xs text-destructive">
                            Reversed
                            {batch.reversed_at
                              ? ` on ${formatInvoiceDate(batch.reversed_at)}`
                              : ""}
                            {batch.reversal_reason?.trim()
                              ? ` · ${batch.reversal_reason.trim()}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-right text-xs text-muted-foreground">
                          <span className="font-medium text-foreground tabular-nums">{units}</span>
                          {" units in this GRN"}
                        </div>
                        {canReverse && !reversed && batch.id ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 cursor-pointer border-border p-0 text-destructive transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive"
                            disabled={busy}
                            title={`Reverse GRN ${batch.grn_number}`}
                            aria-label={`Reverse GRN ${batch.grn_number}`}
                            onClick={() => {
                              setReverseTarget(batch);
                              setReverseReason("");
                            }}
                          >
                            <RotateCcw className="size-4 stroke-[2]" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 cursor-pointer border-border p-0 text-[#0369A1] transition-colors duration-200 hover:bg-sky-50 hover:text-[#0369A1]"
                          disabled={!hasLines || pdfBusyKey === batchPdfKey(batch) || reversing}
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
                            void downloadBatchGrnPdf(batch, pdfContext)
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
                    </div>

                    {batchHasVendorInvoice(batch) ? (
                      <div className="border-b border-border/60 bg-muted/5 px-3 py-2.5 text-xs">
                        <p className="font-medium text-foreground">Vendor invoice</p>
                        <dl className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                          <div>
                            <dt className="text-muted-foreground">Invoice no.</dt>
                            <dd className="tabular-nums text-foreground">
                              {batch.vendor_invoice_number?.trim() || "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Invoice date</dt>
                            <dd className="text-foreground">
                              {formatInvoiceDate(batch.vendor_invoice_date)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Quantity</dt>
                            <dd className="tabular-nums text-foreground">
                              {batch.vendor_invoice_quantity != null
                                ? batch.vendor_invoice_quantity
                                : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Amount (excl. tax)</dt>
                            <dd className="tabular-nums text-foreground">
                              {batch.vendor_invoice_subtotal != null
                                ? batch.vendor_invoice_subtotal
                                : "—"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    ) : null}

                    <div className="px-3 py-3">
                      {hasLines ? (
                        <div className="overflow-x-auto rounded-md border border-border/60">
                          <table className="w-full min-w-[580px] text-left text-xs">
                            <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                              <tr>
                                <th className="px-2.5 py-2 font-medium">#</th>
                                <th className="px-2.5 py-2 font-medium">Product</th>
                                <th className="px-2.5 py-2 font-medium tabular-nums">Qty</th>
                                <th className="px-2.5 py-2 font-medium tabular-nums">Billing</th>
                                <th className="px-2.5 py-2 font-medium">Serial numbers</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batch.lines.map((ln) => (
                                <tr
                                  key={ln.order_line_id}
                                  className="border-b border-border/50 last:border-0"
                                >
                                  <td className="px-2.5 py-2 tabular-nums text-muted-foreground">
                                    {ln.line_number}
                                  </td>
                                  <td className="px-2.5 py-2 text-foreground">
                                    {ln.product_name || "—"}
                                  </td>
                                  <td className="px-2.5 py-2 tabular-nums">{ln.quantity}</td>
                                  <td className="px-2.5 py-2 tabular-nums text-foreground">
                                    {ln.billing === false
                                      ? "0"
                                      : ln.billing_quantity != null
                                        ? ln.billing_quantity
                                        : ln.quantity}
                                  </td>
                                  <td className="max-w-[240px] px-2.5 py-2 text-muted-foreground">
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
                          No line-level detail stored for this GRN (legacy or pending sync).
                        </p>
                      )}

                      <div className="mt-3">
                        <p className="text-xs font-medium text-foreground">Attached documents</p>
                        {attachments.length === 0 ? (
                          <p className="mt-1 text-xs text-muted-foreground">None</p>
                        ) : (
                          <ul className="mt-1.5 space-y-1">
                            {attachments.map((file) => (
                              <li key={file.id}>
                                <button
                                  type="button"
                                  className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-xs text-[#0369A1] transition-colors duration-200 hover:bg-sky-50 hover:underline"
                                  disabled={openingId === file.id}
                                  onClick={() => {
                                    setOpeningId(file.id);
                                    void openReceiptBatchAttachment(file.id)
                                      .catch(() =>
                                        setError("Could not open document. Try again or refresh."),
                                      )
                                      .finally(() => setOpeningId(null));
                                  }}
                                >
                                  <FileText className="size-3.5 shrink-0" aria-hidden />
                                  <span className="truncate">{file.file_name}</span>
                                  <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end border-t border-border/60 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            disabled={busy}
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
    <ReverseGrnConfirmDialog
      batch={reverseTarget}
      reason={reverseReason}
      reversing={reversing}
      error={reverseTarget ? error : null}
      onReasonChange={setReverseReason}
      onCancel={() => {
        if (!reversing) {
          setReverseTarget(null);
          setReverseReason("");
        }
      }}
      onConfirm={() => void onConfirmReverse()}
    />
    </>,
    document.body,
  );
}
