"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, FileDown, FileText, RotateCcw, X } from "lucide-react";

import { ReverseGrnConfirmDialog } from "@/components/procurement/reverse-grn-confirm-dialog";
import { Button } from "@/components/ui/button";
import { formatApiError } from "@/services/api-client";
import {
  listOrderReceiptBatches,
  openReceiptBatchAttachment,
  reverseReceiptBatch,
  type ReceiptBatchAttachment,
  type ScmReceiptBatch,
} from "@/services/procurement-service";
import {
  downloadBatchGrnPdf,
  type GrnReceiptPdfContext,
} from "@/utils/grn-batch-pdf-download";

type BatchRow = {
  batch: ScmReceiptBatch;
  attachments: ReceiptBatchAttachment[];
};

function batchUnits(batch: ScmReceiptBatch): number {
  return (batch.lines || []).reduce((sum, ln) => sum + (Number(ln.quantity) || 0), 0);
}

function batchKey(batch: ScmReceiptBatch): string {
  return `${batch.sequence}:${batch.grn_number}`;
}

function formatInvoiceDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

function formatSerials(serials: string[] | null | undefined): string {
  if (!serials?.length) return "—";
  return serials.join(", ");
}

function isBatchReversed(batch: ScmReceiptBatch): boolean {
  return Boolean(batch.reversed) || (batch.reversal_status || "").toLowerCase() === "reversed";
}

type GrnPdfPickDialogProps = {
  open: boolean;
  orderId: string;
  poLabel: string;
  pdfContext: GrnReceiptPdfContext;
  canReverse?: boolean;
  onClose: () => void;
  onReversed?: () => void;
};

export function GrnPdfPickDialog({
  open,
  orderId,
  poLabel,
  pdfContext,
  canReverse = false,
  onClose,
  onReversed,
}: GrnPdfPickDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [reverseTarget, setReverseTarget] = useState<ScmReceiptBatch | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

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
    setRows([]);
    setSelectedKey("");
    setReverseTarget(null);
    setReverseReason("");
    setSuccess(null);
    void (async () => {
      try {
        const batches = await listOrderReceiptBatches(orderId);
        const printable = batches.filter((b) => batchUnits(b) > 0);
        const sorted = [...printable].sort((a, b) => b.sequence - a.sequence);
        const loaded = sorted.map((batch) => ({
          batch,
          attachments: batch.attachments ?? [],
        }));
        if (!cancelled) {
          setRows(loaded);
          if (loaded.length > 0) {
            setSelectedKey(batchKey(loaded[0].batch));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err, "Failed to load GRN list"));
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

  const downloading = downloadingKey !== null;
  const busy = downloading || reversing;

  async function reloadBatches(preferKey?: string) {
    const batches = await listOrderReceiptBatches(orderId);
    const printable = batches.filter((b) => batchUnits(b) > 0);
    const sorted = [...printable].sort((a, b) => b.sequence - a.sequence);
    const loaded = sorted.map((batch) => ({
      batch,
      attachments: batch.attachments ?? [],
    }));
    setRows(loaded);
    if (loaded.length === 0) {
      setSelectedKey("");
      return;
    }
    const next =
      (preferKey && loaded.find((row) => batchKey(row.batch) === preferKey)
        ? preferKey
        : null) || batchKey(loaded[0].batch);
    setSelectedKey(next);
  }

  async function onDownloadBatch(batch: ScmReceiptBatch) {
    const key = batchKey(batch);
    setDownloadingKey(key);
    setError(null);
    try {
      await downloadBatchGrnPdf(batch, pdfContext);
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim() ? err.message : "Failed to download GRN PDF",
      );
    } finally {
      setDownloadingKey(null);
    }
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
      await reloadBatches(batchKey(batch));
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
        aria-labelledby="grn-pdf-pick-title"
        className="flex max-h-[min(90vh,720px)] w-full max-w-xl flex-col rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <h2 id="grn-pdf-pick-title" className="text-sm font-medium text-foreground">
              GRN &amp; vendor invoice
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{poLabel}</p>
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
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mb-3 rounded-md border border-emerald-200/80 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              {success}
            </div>
          ) : null}

          {loading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading GRN numbers…</p>
          ) : null}

          {!loading && rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No GRN batches with received lines yet. Save a receipt first.
            </p>
          ) : null}

          {!loading && rows.length > 0 ? (
            <fieldset className="space-y-3">
              <legend className="mb-1 text-xs font-medium text-muted-foreground">
                GRN numbers &amp; vendor invoices
              </legend>
              {rows.map(({ batch, attachments }) => {
                const key = batchKey(batch);
                const units = batchUnits(batch);
                const selected = selectedKey === key;
                const reversed = isBatchReversed(batch);
                const radioId =
                  batch.id?.trim() || `grn-pdf-pick-seq-${batch.sequence}`;
                return (
                  <div
                    key={key}
                    className={`rounded-lg border text-sm transition-colors duration-200 ${
                      selected
                        ? reversed
                          ? "border-destructive/40 bg-destructive/5"
                          : "border-[#0369A1]/50 bg-sky-50/40"
                        : "border-border/70 bg-card"
                    }`}
                  >
                    <div className="flex items-start gap-3 px-3 py-2.5">
                      <input
                        id={radioId}
                        type="radio"
                        name="grn-pdf-pick"
                        className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-[#0369A1]"
                        checked={selected}
                        disabled={busy}
                        onChange={() => setSelectedKey(key)}
                      />
                      <label
                        htmlFor={radioId}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <span className="font-medium tabular-nums text-foreground">
                          GRN No. {batch.grn_number}
                        </span>
                        {reversed ? (
                          <span className="ml-2 rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                            Reversed
                          </span>
                        ) : null}
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {units} unit{units === 1 ? "" : "s"} in this GRN
                        </span>
                      </label>
                      {canReverse && !reversed && batch.id ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 shrink-0 cursor-pointer border-border p-0 text-destructive transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive"
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
                        className="h-8 w-8 shrink-0 cursor-pointer border-border p-0 text-[#0369A1] transition-colors duration-200 hover:bg-sky-50 hover:text-[#0369A1]"
                        disabled={units <= 0 || downloadingKey === key || reversing}
                        title={`Download GRN PDF for ${batch.grn_number}`}
                        aria-label={`Download GRN PDF for ${batch.grn_number}`}
                        onClick={() => void onDownloadBatch(batch)}
                      >
                        <FileDown className="size-4 stroke-[2]" />
                      </Button>
                    </div>

                    {selected ? (
                      <div className="border-t border-border/50 px-3 py-2.5 text-xs">
                        <p className="font-medium text-foreground">Items in this GRN</p>
                        {(batch.lines?.length ?? 0) > 0 ? (
                          <div className="mt-1.5 overflow-x-auto rounded-md border border-border/60">
                            <table className="w-full min-w-[360px] text-left">
                              <thead className="border-b border-border/60 bg-muted/30 text-muted-foreground">
                                <tr>
                                  <th className="px-2 py-1.5 font-medium">S No.</th>
                                  <th className="px-2 py-1.5 font-medium">Product</th>
                                  <th className="px-2 py-1.5 font-medium tabular-nums">Qty</th>
                                  <th className="px-2 py-1.5 font-medium tabular-nums">Billing</th>
                                  <th className="px-2 py-1.5 font-medium">Serials</th>
                                </tr>
                              </thead>
                              <tbody>
                                {batch.lines.map((ln) => (
                                  <tr
                                    key={ln.order_line_id}
                                    className="border-b border-border/50 last:border-0"
                                  >
                                    <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                                      {ln.line_number}
                                    </td>
                                    <td className="max-w-[160px] truncate px-2 py-1.5 text-foreground">
                                      {ln.product_name || "—"}
                                    </td>
                                    <td className="px-2 py-1.5 tabular-nums text-foreground">
                                      {ln.quantity}
                                    </td>
                                    <td className="px-2 py-1.5 tabular-nums text-foreground">
                                      {ln.billing === false
                                        ? "0"
                                        : ln.billing_quantity != null
                                          ? ln.billing_quantity
                                          : ln.quantity}
                                    </td>
                                    <td
                                      className="max-w-[140px] truncate px-2 py-1.5 text-muted-foreground"
                                      title={formatSerials(ln.serial_numbers)}
                                    >
                                      {formatSerials(ln.serial_numbers)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="mt-1 text-muted-foreground">
                            No line detail stored for this GRN.
                          </p>
                        )}

                        {reversed ? (
                          <p className="mt-3 text-xs text-destructive">
                            Reversed
                            {batch.reversed_at
                              ? ` on ${formatInvoiceDate(batch.reversed_at)}`
                              : ""}
                            {batch.reversal_reason?.trim()
                              ? ` · ${batch.reversal_reason.trim()}`
                              : ""}
                          </p>
                        ) : null}

                        <p className="mt-3 font-medium text-foreground">Vendor invoice</p>
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

                        <p className="mt-2.5 font-medium text-foreground">Invoice documents</p>
                        {attachments.length === 0 ? (
                          <p className="mt-1 text-muted-foreground">No files attached.</p>
                        ) : (
                          <ul className="mt-1 space-y-1">
                            {attachments.map((file) => (
                              <li key={file.id}>
                                <button
                                  type="button"
                                  className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-[#0369A1] transition-colors duration-200 hover:bg-sky-50/80 hover:underline"
                                  disabled={openingId === file.id}
                                  onClick={() => {
                                    setOpeningId(file.id);
                                    void openReceiptBatchAttachment(file.id)
                                      .catch(() =>
                                        setError(
                                          "Could not open document. Try again or refresh.",
                                        ),
                                      )
                                      .finally(() => setOpeningId(null));
                                  }}
                                >
                                  <FileText className="size-3.5 shrink-0" aria-hidden />
                                  <span className="truncate">{file.file_name}</span>
                                  <ExternalLink
                                    className="size-3 shrink-0 opacity-70"
                                    aria-hidden
                                  />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </fieldset>
          ) : null}
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
