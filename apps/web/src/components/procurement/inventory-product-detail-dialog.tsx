"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { procurementUi } from "@/components/procurement/procurement-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatInr,
  type ProcurementInventoryRow,
} from "@/services/procurement-service";
import {
  formatInventoryDateAdded,
  formatInventoryWarrantyLabel,
  inventoryRowStableKey,
  isInventoryWarrantyExpired,
  nonBilledStockQuantity,
  type GrnStockByProductRow,
} from "@/utils/procurement-inventory-report";

function displaySerial(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text || text.toUpperCase() === "NA" || text === "-") return "";
  return text;
}

type MergedUnitRow = {
  key: string;
  companyPoNumber: string;
  grnNumber: string;
  hasReversal: boolean;
  serials: string;
  dateAdded: string | null;
  warrantyUntil: string | null;
  qty: number;
  rate: number;
  lines: ProcurementInventoryRow[];
};

function mergeUnitRows(lines: ProcurementInventoryRow[]): MergedUnitRow[] {
  const map = new Map<string, MergedUnitRow>();
  for (const row of lines) {
    const companyPoNumber = (row.company_po_number ?? "").trim() || "-";
    const grnNumber = (row.grn_number ?? "").trim() || "-";
    const key = `${companyPoNumber}::${grnNumber}`;
    const qty = nonBilledStockQuantity(row);
    const serial = displaySerial(row.serial_number);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        companyPoNumber,
        grnNumber,
        hasReversal: row.source === "grn_reversal",
        serials: serial,
        dateAdded: row.receipt_at ?? null,
        warrantyUntil: row.warranty_valid_till ?? null,
        qty,
        rate: Number(row.unit_cost) || 0,
        lines: [row],
      });
      continue;
    }
    existing.qty += qty;
    existing.hasReversal = existing.hasReversal || row.source === "grn_reversal";
    existing.lines.push(row);
    if (serial) {
      const parts = existing.serials
        ? existing.serials.split(", ").filter(Boolean)
        : [];
      if (!parts.includes(serial)) parts.push(serial);
      existing.serials = parts.join(", ");
    }
    if (!existing.dateAdded && row.receipt_at) existing.dateAdded = row.receipt_at;
    if (!existing.warrantyUntil && row.warranty_valid_till) {
      existing.warrantyUntil = row.warranty_valid_till;
    }
    const cost = Number(row.unit_cost) || 0;
    if (cost > 0 && existing.rate <= 0) existing.rate = cost;
  }

  return Array.from(map.values()).sort((a, b) => {
    const po = a.companyPoNumber.localeCompare(b.companyPoNumber, undefined, {
      numeric: true,
    });
    if (po !== 0) return po;
    return a.grnNumber.localeCompare(b.grnNumber, undefined, { numeric: true });
  });
}

type InventoryProductDetailDialogProps = {
  open: boolean;
  product: GrnStockByProductRow | null;
  onClose: () => void;
  onRefresh: () => void;
  onError: (message: string | null) => void;
};

export function InventoryProductDetailDialog({
  open,
  product,
  onClose,
  onRefresh: _onRefresh,
  onError: _onError,
}: InventoryProductDetailDialogProps) {
  void _onRefresh;
  void _onError;
  const [mounted, setMounted] = useState(false);

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

  const mergedRows = useMemo(() => {
    if (!product) return [];
    return mergeUnitRows(product.lines);
  }, [product]);

  if (!open || !mounted || !product) return null;

  const description = (product.description || "").trim();

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-product-detail-title"
        className="flex max-h-[min(90vh,720px)] w-full max-w-5xl flex-col rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <h2
              id="inventory-product-detail-title"
              className="text-base font-semibold tracking-tight"
            >
              {product.productName}
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {description && description !== "-" ? (
            <p className="mb-3 text-sm text-muted-foreground whitespace-pre-wrap">
              {description}
            </p>
          ) : null}
          <div className={procurementUi.tableShell}>
            <div className="overflow-x-auto">
              <table className={cn(procurementUi.table, "w-full min-w-[720px] table-fixed")}>
                <colgroup>
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                  <col className="w-[28%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead className={procurementUi.thead}>
                  <tr>
                    <th className={cn(procurementUi.th, "px-2")}>Company PO</th>
                    <th className={cn(procurementUi.th, "px-2")}>GRN</th>
                    <th className={cn(procurementUi.th, "px-2")}>Serial</th>
                    <th className={cn(procurementUi.th, "px-2")}>Date added</th>
                    <th className={cn(procurementUi.th, "px-2")}>Warranty until</th>
                    <th className={cn(procurementUi.th, "px-2 text-right")}>Qty</th>
                    <th className={cn(procurementUi.th, "px-2 text-right")}>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {mergedRows.map((row) => {
                    const expired = isInventoryWarrantyExpired(row.warrantyUntil);
                    return (
                      <tr
                        key={row.key || inventoryRowStableKey(row.lines[0]!, 0)}
                        className={cn(procurementUi.tr, expired && "bg-destructive/5")}
                      >
                        <td
                          className={cn(
                            procurementUi.td,
                            "max-w-0 truncate px-2 font-mono text-xs tabular-nums",
                          )}
                          title={row.companyPoNumber !== "-" ? row.companyPoNumber : undefined}
                        >
                          {row.companyPoNumber}
                        </td>
                        <td
                          className={cn(
                            procurementUi.td,
                            "max-w-0 truncate px-2 font-mono text-xs tabular-nums",
                          )}
                          title={row.grnNumber !== "-" ? row.grnNumber : undefined}
                        >
                          {row.grnNumber}
                          {row.hasReversal ? (
                            <span className="ml-1 text-[10px] font-medium uppercase text-destructive">
                              Rev
                            </span>
                          ) : null}
                        </td>
                        <td
                          className={cn(
                            procurementUi.td,
                            "min-w-0 px-2 text-xs break-words",
                          )}
                          title={row.serials || undefined}
                        >
                          {row.serials || "-"}
                        </td>
                        <td
                          className={cn(
                            procurementUi.td,
                            "px-2 text-xs text-muted-foreground",
                          )}
                        >
                          {formatInventoryDateAdded(row.dateAdded)}
                        </td>
                        <td
                          className={cn(
                            procurementUi.td,
                            "px-2 text-xs font-medium",
                            expired ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {formatInventoryWarrantyLabel(row.warrantyUntil)}
                        </td>
                        <td
                          className={cn(
                            procurementUi.tdNumeric,
                            "px-2 text-right font-mono tabular-nums",
                          )}
                        >
                          {row.qty.toLocaleString("en-IN")}
                        </td>
                        <td
                          className={cn(
                            procurementUi.tdNumeric,
                            "px-2 text-right font-mono tabular-nums",
                          )}
                        >
                          {formatInr(row.rate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
