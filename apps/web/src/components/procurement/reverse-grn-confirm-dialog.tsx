"use client";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ScmReceiptBatch } from "@/services/procurement-service";

type ReverseGrnConfirmDialogProps = {
  batch: ScmReceiptBatch | null;
  reason: string;
  reversing: boolean;
  error?: string | null;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ReverseGrnConfirmDialog({
  batch,
  reason,
  reversing,
  error,
  onReasonChange,
  onCancel,
  onConfirm,
}: ReverseGrnConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={batch != null}
      title={`Reverse GRN ${batch?.grn_number ?? ""}`}
      description="This subtracts the GRN quantities from the purchase order, adjusts inventory, and reopens a completed PO if needed. This cannot be undone."
      confirmLabel="Reverse GRN"
      tone="destructive"
      busy={reversing}
      confirmDisabled={!reason.trim()}
      overlayClassName="z-[220]"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <label className="mt-3 block text-xs font-medium text-foreground">
        Reason
        <Textarea
          className="mt-1.5"
          value={reason}
          disabled={reversing}
          onChange={(e) => onReasonChange(e.target.value)}
        />
      </label>
      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : null}
    </ConfirmDialog>
  );
}
