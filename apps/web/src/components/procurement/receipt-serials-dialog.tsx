"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";

import { ReceiptSerialsTable } from "@/components/procurement/receipt-line-serials";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { extractVendorInvoiceFromFile } from "@/services/procurement-service";
import { ApiClientError } from "@/services/api-client";
import {
  VENDOR_INVOICE_FILE_ACCEPT,
  validateVendorInvoiceFile,
} from "@/utils/vendor-invoice-file";

export type ReceiptSerialDialogLine = {
  lineId: string;
  lineNo: number;
  productLabel: string;
  additional: number;
  billingQuantity: number;
};

export type VendorInvoiceDraft = {
  files: File[];
  invoiceNumber: string;
  invoiceDate: string;
  quantity: string;
  subtotal: string;
};

export const emptyVendorInvoiceDraft = (): VendorInvoiceDraft => ({
  files: [],
  invoiceNumber: "",
  invoiceDate: "",
  quantity: "",
  subtotal: "",
});

type ReceiptSerialsDialogProps = {
  open: boolean;
  grnLabel: string;
  lines: ReceiptSerialDialogLine[];
  serialDraft: Record<string, string[]>;
  busy?: boolean;
  error?: string | null;
  onSerialDraftChange: (lineId: string, slots: string[]) => void;
  onBillingQuantityChange?: (lineId: string, billingQuantity: number) => void;
  onSerialImportError?: (message: string | null) => void;
  vendorInvoice: VendorInvoiceDraft;
  onVendorInvoiceChange: Dispatch<SetStateAction<VendorInvoiceDraft>>;
  onConfirm: () => void;
  onClose: () => void;
};

export function ReceiptSerialsDialog({
  open,
  grnLabel,
  lines,
  serialDraft,
  busy,
  error,
  onSerialDraftChange,
  onBillingQuantityChange,
  onSerialImportError,
  vendorInvoice,
  onVendorInvoiceChange,
  onConfirm,
  onClose,
}: ReceiptSerialsDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [invoiceExtracting, setInvoiceExtracting] = useState(false);
  const [invoiceExtractHint, setInvoiceExtractHint] = useState<string | null>(null);

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

  async function runInvoiceExtract(first: File, filesAfterAdd: File[]) {
    setInvoiceExtractHint(null);
    setInvoiceExtracting(true);
    try {
      const extracted = await extractVendorInvoiceFromFile(first);
      let quantity =
        extracted.vendor_invoice_quantity != null
          ? String(extracted.vendor_invoice_quantity)
          : "";
      let subtotal =
        extracted.vendor_invoice_subtotal != null
          ? String(extracted.vendor_invoice_subtotal)
          : "";
      const qtyNum = quantity.trim() ? Number(quantity) : NaN;
      const subNum = subtotal.trim() ? Number(subtotal) : NaN;
      if (
        Number.isFinite(qtyNum) &&
        Number.isFinite(subNum) &&
        Math.abs(qtyNum - subNum) < 0.01
      ) {
        subtotal = "";
      }
      const pendingReceiptQty = lines.reduce((sum, row) => sum + row.additional, 0);
      let extractHint: string | null = null;
      onVendorInvoiceChange((prev) => {
        const next: VendorInvoiceDraft = {
          files: filesAfterAdd,
          invoiceNumber:
            extracted.vendor_invoice_number?.trim() ||
            prev.invoiceNumber.trim() ||
            "",
          invoiceDate:
            extracted.vendor_invoice_date?.slice(0, 10) ||
            prev.invoiceDate.trim() ||
            "",
          quantity:
            quantity ||
            (pendingReceiptQty > 0 ? String(pendingReceiptQty) : "") ||
            prev.quantity.trim() ||
            "",
          subtotal: subtotal || prev.subtotal.trim() || "",
        };
        const found =
          next.invoiceNumber || next.invoiceDate || next.quantity || next.subtotal;
        extractHint = found
          ? null
          : "Could not read invoice automatically. Enter invoice no., date, quantity, and amount (excl. tax) below.";
        return next;
      });
      setInvoiceExtractHint(extractHint);
    } catch (err) {
      const detail =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error && err.message.trim()
            ? err.message
            : "Extraction failed.";
      setInvoiceExtractHint(
        `${detail} Enter invoice number, date, quantity, and total amount manually.`,
      );
    } finally {
      setInvoiceExtracting(false);
    }
  }

  function onVendorInvoiceFilesPicked(picked: FileList | null) {
    if (!picked?.length) return;
    const newFiles = Array.from(picked);
    for (const file of newFiles) {
      const validationError = validateVendorInvoiceFile(file);
      if (validationError) {
        setInvoiceExtractHint(validationError);
        return;
      }
    }
    const filesAfterAdd = [...vendorInvoice.files, ...newFiles];
    onVendorInvoiceChange((prev) => ({ ...prev, files: [...prev.files, ...newFiles] }));
    void runInvoiceExtract(newFiles[0], filesAfterAdd);
  }

  if (!open || !mounted) return null;

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
        aria-labelledby="receipt-serials-dialog-title"
        className="flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border/60 px-5 py-4">
          <h2
            id="receipt-serials-dialog-title"
            className="text-sm font-medium tracking-tight text-foreground"
          >
            Update receipt &amp; vendor invoice
          </h2>
          <p
            className="text-center text-sm font-semibold tabular-nums tracking-tight text-foreground"
            title="GRN number for this receipt"
          >
            {grnLabel}
          </p>
          <div className="flex justify-end">
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
              <p className="text-xs font-medium text-foreground">Vendor invoice</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label
                  className={cn(
                    buttonVariants({ size: "sm", variant: "default" }),
                    "h-8 cursor-pointer transition-colors duration-200",
                    (busy || invoiceExtracting) && "pointer-events-none opacity-50",
                  )}
                >
                  <FileText className="mr-1.5 size-3.5" />
                  Add document
                  <input
                    type="file"
                    accept={VENDOR_INVOICE_FILE_ACCEPT}
                    className="sr-only"
                    multiple
                    disabled={busy || invoiceExtracting}
                    onChange={(e) => {
                      onVendorInvoiceFilesPicked(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                {vendorInvoice.files.length > 0 ? (
                  <ul className="min-w-0 flex-1 space-y-1">
                    {vendorInvoice.files.map((doc, index) => (
                      <li
                        key={`${doc.name}-${doc.size}-${index}`}
                        className="flex items-center gap-2 text-xs text-foreground"
                      >
                        <span className="min-w-0 truncate" title={doc.name}>{doc.name}</span>
                        <button
                          type="button"
                          className="shrink-0 cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
                          disabled={busy || invoiceExtracting}
                          aria-label={`Remove ${doc.name}`}
                          onClick={() =>
                            onVendorInvoiceChange((prev) => ({
                              ...prev,
                              files: prev.files.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {invoiceExtracting ? (
                  <span className="text-xs text-muted-foreground">Extracting from invoice…</span>
                ) : null}
              </div>
              {invoiceExtractHint ? (
                <p className="mt-2 text-xs text-muted-foreground">{invoiceExtractHint}</p>
              ) : null}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="vendor-invoice-number" className="text-xs font-medium text-foreground">
                    Invoice number
                  </label>
                  <Input
                    id="vendor-invoice-number"
                    className="h-8 text-xs"
                    disabled={busy || invoiceExtracting}
                    placeholder="From invoice"
                    value={vendorInvoice.invoiceNumber}
                    onChange={(e) =>
                      onVendorInvoiceChange({ ...vendorInvoice, invoiceNumber: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="vendor-invoice-date" className="text-xs font-medium text-foreground">
                    Invoice date
                  </label>
                  <Input
                    id="vendor-invoice-date"
                    type="date"
                    className="h-8 text-xs"
                    disabled={busy || invoiceExtracting}
                    value={vendorInvoice.invoiceDate}
                    onChange={(e) =>
                      onVendorInvoiceChange({ ...vendorInvoice, invoiceDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="vendor-invoice-qty" className="text-xs font-medium text-foreground">
                    Quantity
                  </label>
                  <Input
                    id="vendor-invoice-qty"
                    inputMode="decimal"
                    className="h-8 text-xs tabular-nums"
                    disabled={busy || invoiceExtracting}
                    placeholder="Total qty on invoice"
                    value={vendorInvoice.quantity}
                    onChange={(e) =>
                      onVendorInvoiceChange({ ...vendorInvoice, quantity: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="vendor-invoice-subtotal" className="text-xs font-medium text-foreground">
                    Total amount
                  </label>
                  <Input
                    id="vendor-invoice-subtotal"
                    inputMode="decimal"
                    className="h-8 text-xs tabular-nums"
                    disabled={busy || invoiceExtracting}
                    placeholder="Taxable / amount without tax"
                    value={vendorInvoice.subtotal}
                    onChange={(e) =>
                      onVendorInvoiceChange({ ...vendorInvoice, subtotal: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            ) : null}

            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lines selected for receipt.</p>
            ) : (
              <ReceiptSerialsTable
                lines={lines}
                serialDraft={serialDraft}
                disabled={busy}
                onChange={onSerialDraftChange}
                onBillingQuantityChange={onBillingQuantityChange}
                onImportError={onSerialImportError}
              />
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border/60 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            disabled={busy}
            onClick={onClose}
          >
            Back
          </Button>
          <Button
            type="button"
            className="cursor-pointer transition-colors duration-200"
            disabled={busy || lines.length === 0}
            onClick={onConfirm}
          >
            {busy ? "Saving…" : "Save receipt"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
