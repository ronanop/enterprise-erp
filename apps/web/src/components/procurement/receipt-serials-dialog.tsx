"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import {
  ReceiptSerialsTable,
  type GrnLineDisposition,
  type GrnUnitKind,
} from "@/components/procurement/receipt-line-serials";
import { Button } from "@/components/ui/button";
import {
  resizeSerialSlots,
  serialUnitCount,
  validateSerialSlots,
} from "@/utils/receipt-serial-numbers";

export type ReceiptSerialDialogLine = {
  lineId: string;
  lineNo: number;
  productLabel: string;
  productName?: string;
  description?: string;
  hsnSac?: string;
  additional: number;
  billingQuantity: number;
  disposition: GrnLineDisposition;
  unitKinds?: GrnUnitKind[];
  maxAdditional?: number;
  deliveryChallanQuantity?: number;
};

type ReceiptSerialsDialogProps = {
  open: boolean;
  grnLabel: string;
  lines: ReceiptSerialDialogLine[];
  serialDraft: Record<string, string[]>;
  busy?: boolean;
  error?: string | null;
  onSerialDraftChange: (lineId: string, slots: string[]) => void;
  onDispositionChange?: (lineId: string, kind: GrnUnitKind) => void;
  onQuantityChange?: (lineId: string, quantity: number) => void;
  onSerialImportError?: (message: string | null) => void;
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
  onDispositionChange,
  onQuantityChange,
  onSerialImportError,
  onConfirm,
  onClose,
}: ReceiptSerialsDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [localSerialError, setLocalSerialError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setLocalSerialError(null);
  }, [open]);

  function handleConfirm() {
    setLocalSerialError(null);
    for (const row of lines) {
      const units = serialUnitCount(row.additional);
      if (units <= 0) continue;
      const slots = resizeSerialSlots(serialDraft[row.lineId] || [], units);
      const serialError = validateSerialSlots(slots, row.additional, row.productLabel);
      if (serialError) {
        setLocalSerialError(serialError);
        return;
      }
    }
    onConfirm();
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
        className="flex max-h-[min(90vh,720px)] w-full max-w-4xl flex-col rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border/60 px-5 py-4">
          <h2
            id="receipt-serials-dialog-title"
            className="text-sm font-medium tracking-tight text-foreground"
          >
            Update receipt
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
            {error || localSerialError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {localSerialError || error}
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
                onDispositionChange={onDispositionChange}
                onQuantityChange={onQuantityChange}
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
            onClick={handleConfirm}
          >
            {busy ? "Saving…" : "Save receipt"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
