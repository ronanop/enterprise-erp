"use client";

import { useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import {
  FinanceField,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { Input } from "@/components/ui/input";

export type ManualInventoryStockDraft = {
  product_name: string;
  description: string | null;
  serial_number: string;
  order_id: string | null;
};

type ProcurementInventoryAddStockDialogProps = {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (lines: ManualInventoryStockDraft[]) => void;
};

function resizeSerials(prev: string[], qty: number): string[] {
  if (qty < 1) return [""];
  if (prev.length === qty) return prev;
  if (prev.length > qty) return prev.slice(0, qty);
  return [...prev, ...Array.from({ length: qty - prev.length }, () => "")];
}

export function ProcurementInventoryAddStockDialog({
  open,
  busy,
  error,
  onClose,
  onConfirm,
}: ProcurementInventoryAddStockDialogProps) {
  const [product, setProduct] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [serials, setSerials] = useState<string[]>([""]);
  const [localError, setLocalError] = useState<string | null>(null);

  const qty = useMemo(() => {
    const n = Number.parseInt(quantity, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [quantity]);

  useEffect(() => {
    if (!open) {
      setProduct("");
      setDescription("");
      setQuantity("1");
      setSerials([""]);
      setLocalError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSerials((prev) => resizeSerials(prev, qty > 0 ? qty : 1));
  }, [open, qty]);

  function setSerialAt(index: number, value: string) {
    setSerials((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function onSave() {
    const name = product.trim();
    if (!name) {
      setLocalError("Product name is required.");
      return;
    }
    if (qty < 1) {
      setLocalError("Enter a quantity of at least 1.");
      return;
    }
    const trimmed = serials.slice(0, qty).map((s) => s.trim());
    const emptyIndex = trimmed.findIndex((s) => !s);
    if (emptyIndex >= 0) {
      setLocalError(`Enter serial number for unit ${emptyIndex + 1}.`);
      return;
    }
    const unique = new Set(trimmed.map((s) => s.toLowerCase()));
    if (unique.size !== trimmed.length) {
      setLocalError("Each unit needs a unique serial number.");
      return;
    }

    const desc = description.trim() || null;
    setLocalError(null);
    onConfirm(
      trimmed.map((serial_number) => ({
        product_name: name,
        description: desc,
        serial_number,
        order_id: null,
      })),
    );
  }

  const displayError = localError || error;

  return (
    <ConfirmDialog
      open={open}
      title="Add stock manually"
      confirmLabel={busy ? "Saving…" : "Add to stock"}
      cancelLabel="Cancel"
      busy={busy}
      confirmDisabled={busy}
      contentClassName="max-w-lg"
      onConfirm={onSave}
      onCancel={() => {
        if (!busy) onClose();
      }}
    >
      <div className="mt-3 space-y-3">
        {displayError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {displayError}
          </div>
        ) : null}

        <FinanceField label="Product name *">
          <Input
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="h-9"
            placeholder="e.g. Enterprise Server Rack Unit"
            disabled={busy}
            autoFocus
          />
        </FinanceField>

        <FinanceField label="Description">
          <FinanceTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Item description"
            disabled={busy}
          />
        </FinanceField>

        <FinanceField label="Quantity *">
          <Input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d]/g, "");
              setQuantity(raw === "" ? "" : String(Math.max(1, Number.parseInt(raw, 10) || 1)));
            }}
            className="h-9"
            disabled={busy}
          />
        </FinanceField>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Serial numbers * ({qty > 0 ? qty : 1} required)
          </p>
          <div className="max-h-48 space-y-2 overflow-y-auto pr-0.5">
            {(qty > 0 ? serials.slice(0, qty) : serials.slice(0, 1)).map((serial, index) => (
              <FinanceField key={`serial-${index}`} label={`Serial ${index + 1}`}>
                <Input
                  value={serial}
                  onChange={(e) => setSerialAt(index, e.target.value)}
                  className="h-9"
                  placeholder={`Serial for unit ${index + 1}`}
                  disabled={busy}
                />
              </FinanceField>
            ))}
          </div>
        </div>
      </div>
    </ConfirmDialog>
  );
}
