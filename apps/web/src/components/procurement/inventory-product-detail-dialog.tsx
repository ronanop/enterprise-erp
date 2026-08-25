"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { InventorySerialEditor } from "@/components/procurement/inventory-serial-editor";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatInr } from "@/services/procurement-service";
import {
  inventoryRowStableKey,
  nonBilledStockQuantity,
  type GrnStockByProductRow,
} from "@/utils/procurement-inventory-report";

function displaySerial(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text || text.toUpperCase() === "NA" || text === "—" || text === "-") return "—";
  return text;
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
  onRefresh,
  onError,
}: InventoryProductDetailDialogProps) {
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

  const unitRows = useMemo(() => {
    if (!product) return [];
    return [...product.lines].sort((a, b) => {
      const po = (a.company_po_number ?? "").localeCompare(b.company_po_number ?? "", undefined, {
        numeric: true,
      });
      if (po !== 0) return po;
      const grn = (a.grn_number ?? "").localeCompare(b.grn_number ?? "", undefined, {
        numeric: true,
      });
      if (grn !== 0) return grn;
      return displaySerial(a.serial_number).localeCompare(displaySerial(b.serial_number));
    });
  }, [product]);

  if (!open || !mounted || !product) return null;

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
        className="flex max-h-[min(88vh,640px)] w-full max-w-2xl flex-col rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <h2 id="inventory-product-detail-title" className="text-base font-semibold tracking-tight">
              {product.productName}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {product.stockQty.toLocaleString("en-IN")} unit{product.stockQty === 1 ? "" : "s"} on
              hand · avg {formatInr(product.avgUnitCost)}
            </p>
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
          <p className="mb-3 text-xs text-muted-foreground">
            Source breakdown by company PO, GRN, serial, and vendor rate.
          </p>
          <div className={procurementUi.tableShell}>
            <div className={procurementUi.tableScroll}>
              <table className={cn(procurementUi.table, "min-w-[520px]")}>
                <thead className={procurementUi.thead}>
                  <tr>
                    <th className={cn(procurementUi.th, "px-3")}>Company PO</th>
                    <th className={cn(procurementUi.th, "px-3")}>GRN</th>
                    <th className={cn(procurementUi.th, "px-3")}>Serial</th>
                    <th className={cn(procurementUi.th, "px-3 text-right")}>Qty</th>
                    <th className={cn(procurementUi.th, "px-3 text-right")}>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {unitRows.map((row, index) => (
                    <tr key={inventoryRowStableKey(row, index)} className={procurementUi.tr}>
                      <td className={cn(procurementUi.td, "px-3 font-mono text-xs tabular-nums")}>
                        {row.company_po_number?.trim() || "—"}
                      </td>
                      <td className={cn(procurementUi.td, "px-3 font-mono text-xs tabular-nums")}>
                        {row.grn_number?.trim() || "—"}
                        {row.source === "grn_reversal" ? (
                          <span className="ml-1.5 text-[10px] font-medium uppercase text-destructive">
                            Rev
                          </span>
                        ) : null}
                      </td>
                      <td className={cn(procurementUi.td, "px-3 min-w-[120px]")}>
                        <InventorySerialEditor
                          row={row}
                          onSaved={onRefresh}
                          onError={onError}
                        />
                      </td>
                      <td
                        className={cn(
                          procurementUi.tdNumeric,
                          "px-3 text-right font-mono tabular-nums",
                        )}
                      >
                        {nonBilledStockQuantity(row).toLocaleString("en-IN")}
                      </td>
                      <td
                        className={cn(
                          procurementUi.tdNumeric,
                          "px-3 text-right font-mono tabular-nums",
                        )}
                      >
                        {formatInr(Number(row.unit_cost) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-border/60 px-5 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
