"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  updateInventoryImportSerial,
  updateInventoryStockSerial,
  type ProcurementInventoryRow,
} from "@/services/procurement-service";

function isMissingSerial(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();
  if (!text) return true;
  const upper = text.toUpperCase();
  return upper === "—" || upper === "-" || upper === "NA" || upper === "N/A";
}

function displaySerial(value: string | null | undefined): string {
  if (isMissingSerial(value)) return "";
  return (value ?? "").trim();
}

export function InventorySerialEditor({
  row,
  onSaved,
  onError,
}: {
  row: ProcurementInventoryRow;
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  const canEdit = Boolean(row.stock_unit_id || row.import_line_id);
  const [value, setValue] = useState(() => displaySerial(row.serial_number));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(displaySerial(row.serial_number));
  }, [row.serial_number]);

  async function commit() {
    const next = value.trim();
    if (!canEdit) return;
    const prev = displaySerial(row.serial_number);
    if (next === prev) return;
    if (!next) {
      onError("Serial number cannot be empty.");
      setValue(prev);
      return;
    }
    setBusy(true);
    onError(null);
    try {
      if (row.stock_unit_id) {
        await updateInventoryStockSerial(row.stock_unit_id, next);
      } else if (row.import_line_id) {
        await updateInventoryImportSerial(row.import_line_id, next);
      }
      onSaved();
    } catch (err) {
      onError(formatApiError(err, "Failed to save serial number"));
      setValue(prev);
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        {displaySerial(row.serial_number) || "—"}
      </span>
    );
  }

  return (
    <Input
      value={value}
      disabled={busy}
      placeholder="Add serial…"
      aria-label={`Serial for ${row.product_name ?? "product"}`}
      className={cn(
        "h-8 font-mono text-xs",
        isMissingSerial(row.serial_number) && !value && "border-amber-300/80 bg-amber-50/50",
      )}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
    />
  );
}
