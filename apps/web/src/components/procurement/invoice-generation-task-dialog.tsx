"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileUp, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assertSafeUploadFile } from "@/lib/safe-attachment";
import { formatApiError } from "@/services/api-client";
import {
  listMyInvoiceGenerationTasks,
  submitInvoiceGenerationTask,
  type ProcInvoiceGenerationTask,
} from "@/services/procurement-service";

type InvoiceGenerationTaskDialogProps = {
  open: boolean;
  /** Prefer an explicit task; otherwise load by id from the assignee's pending list. */
  task?: ProcInvoiceGenerationTask | null;
  taskId?: string | null;
  onClose: () => void;
  onCompleted?: () => void;
};

function formatScmQuantity(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, "");
}

function formatScmAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function scmTotals(task: ProcInvoiceGenerationTask): { qty: number; amount: number } {
  const qty =
    Number(task.suggested_quantity) > 0
      ? Number(task.suggested_quantity)
      : Number(task.invoice_quantity) || 0;
  const amount =
    Number(task.suggested_amount) > 0
      ? Number(task.suggested_amount)
      : Number(task.invoice_amount) || 0;
  return { qty, amount };
}

export function InvoiceGenerationTaskDialog({
  open,
  task: taskProp,
  taskId,
  onClose,
  onCompleted,
}: InvoiceGenerationTaskDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [task, setTask] = useState<ProcInvoiceGenerationTask | null>(taskProp ?? null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

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
    if (!open) return;

    function applyTask(found: ProcInvoiceGenerationTask) {
      setTask(found);
      setInvoiceNumber(found.invoice_number || "");
      setInvoiceDate(found.invoice_date?.slice(0, 10) || "");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

    if (taskProp) {
      applyTask(taskProp);
      setError(null);
      setLoading(false);
      return;
    }

    const id = taskId?.trim();
    if (!id) {
      setTask(null);
      setError("Invoice job not found.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const rows = await listMyInvoiceGenerationTasks(null);
        if (cancelled) return;
        const found = rows.find((row) => String(row.id) === id) || null;
        if (!found) {
          setTask(null);
          setError("Invoice job not found or already completed.");
          return;
        }
        applyTask(found);
      } catch (err) {
        if (!cancelled) {
          setTask(null);
          setError(formatApiError(err, "Failed to load invoice job"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, taskProp, taskId]);

  function onPickFile(file: File | null) {
    if (!file) {
      setAttachment(null);
      return;
    }
    try {
      assertSafeUploadFile(file);
      setAttachment(file);
      setError(null);
    } catch (err) {
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setError(err instanceof Error ? err.message : "File type is not allowed.");
    }
  }

  async function onSubmit() {
    if (!task) return;
    if (!invoiceNumber.trim()) {
      setError("Invoice number is required.");
      return;
    }
    if (!invoiceDate.trim()) {
      setError("Invoice date is required.");
      return;
    }
    if (!attachment) {
      setError("Attach the invoice document before completing.");
      return;
    }
    const { qty, amount } = scmTotals(task);
    setSaving(true);
    setError(null);
    try {
      assertSafeUploadFile(attachment);
      await submitInvoiceGenerationTask(task.id, {
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate.trim(),
        invoice_quantity: qty,
        invoice_amount: amount,
        file: attachment,
      });
      onCompleted?.();
      onClose();
    } catch (err) {
      setError(formatApiError(err, "Failed to submit invoice details"));
    } finally {
      setSaving(false);
    }
  }

  if (!open || !mounted) return null;

  const busy = saving || loading;
  const totals = task ? scmTotals(task) : { qty: 0, amount: 0 };

  return createPortal(
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
        aria-labelledby="invoice-generation-dialog-title"
        className="flex w-full max-w-lg flex-col rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="invoice-generation-dialog-title"
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              {task?.purchase_order_number
                ? `Invoice generation · ${task.purchase_order_number}`
                : task?.title || "Invoice generation"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[
                task?.purchase_order_number,
                task?.grn_number,
                task?.vendor_name,
                task?.items_summary,
              ]
                .filter(Boolean)
                .join(" · ") || "Fill invoice number and date. Qty/amount come from the billed selection."}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 cursor-pointer"
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </div>
          ) : null}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading job…</p>
          ) : task ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="inv-dialog-number">
                    Invoice number *
                  </label>
                  <Input
                    id="inv-dialog-number"
                    className="h-8"
                    disabled={saving}
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="inv-dialog-date">
                    Invoice date *
                  </label>
                  <Input
                    id="inv-dialog-date"
                    type="date"
                    className="h-8"
                    disabled={saving}
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="inv-dialog-qty">
                    Quantity
                  </label>
                  <Input
                    id="inv-dialog-qty"
                    className="h-8 tabular-nums bg-muted/40"
                    disabled
                    readOnly
                    value={formatScmQuantity(totals.qty)}
                    title="From the billed selection / SCM Billing"
                    aria-describedby="inv-dialog-scm-hint"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="inv-dialog-amount">
                    Amount
                  </label>
                  <Input
                    id="inv-dialog-amount"
                    className="h-8 tabular-nums bg-muted/40"
                    disabled
                    readOnly
                    value={formatScmAmount(totals.amount)}
                    title="Auto-fetched from SCM Billing GRN × PO rates"
                    aria-describedby="inv-dialog-scm-hint"
                  />
                </div>
              </div>
              <p id="inv-dialog-scm-hint" className="text-[11px] text-muted-foreground">
                Quantity and amount come from the billed stock selection (or SCM Billing totals).
              </p>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-foreground">Invoice document *</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/*"
                  disabled={saving}
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 cursor-pointer gap-1.5 transition-colors duration-200"
                    disabled={saving}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="size-3.5" aria-hidden />
                    {attachment ? "Replace file" : "Attach document"}
                  </Button>
                  {attachment ? (
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 px-2 py-1 text-xs text-foreground">
                      <FileUp className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate" title={attachment.name}>
                        {attachment.name}
                      </span>
                      <button
                        type="button"
                        className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                        aria-label="Remove attachment"
                        disabled={saving}
                        onClick={() => {
                          setAttachment(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">PDF, image, or Office file</span>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border/60 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer transition-colors duration-200"
            disabled={busy || !task}
            onClick={() => void onSubmit()}
          >
            {saving ? "Saving…" : "Complete"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
