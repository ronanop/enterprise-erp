"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, X } from "lucide-react";

import { procurementUi } from "@/components/procurement/procurement-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProcOrder } from "@/services/procurement-service";
import { parseInventoryImportExcel } from "@/utils/inventory-import-excel";

export const INVENTORY_WITHOUT_PO = "";

export type InventoryImportDraftRow = {
  id: string;
  product: string;
  serial: string;
  orderId: string;
};

type ProcurementInventoryImportDialogProps = {
  open: boolean;
  purchaseOrders: ProcOrder[];
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (rows: InventoryImportDraftRow[]) => void;
};

function poLabel(order: ProcOrder): string {
  return order.company_po_number?.trim() || order.document_number;
}

export function ProcurementInventoryImportDialog({
  open,
  purchaseOrders,
  busy,
  error,
  onClose,
  onConfirm,
}: ProcurementInventoryImportDialogProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<InventoryImportDraftRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [bulkPoId, setBulkPoId] = useState(INVENTORY_WITHOUT_PO);

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
    if (!open) {
      setRows([]);
      setParseError(null);
      setBulkPoId(INVENTORY_WITHOUT_PO);
    }
  }, [open]);

  if (!open || !mounted) return null;

  async function onFileSelected(file: File) {
    setParseError(null);
    const result = await parseInventoryImportExcel(file);
    if (!result.ok) {
      setParseError(result.message);
      return;
    }
    setRows(
      result.rows.map((row, index) => ({
        id: `import-${index}-${Date.now()}`,
        product: row.product,
        serial: row.serial,
        orderId: INVENTORY_WITHOUT_PO,
      })),
    );
  }

  function applyBulkPo() {
    setRows((prev) => prev.map((r) => ({ ...r, orderId: bulkPoId })));
  }

  function onSave() {
    if (rows.length === 0) {
      setParseError("Import an Excel file with at least one product and serial.");
      return;
    }
    onConfirm(rows);
  }

  const displayError = parseError || error;

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
        aria-labelledby="inventory-import-title"
        className="flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <h2 id="inventory-import-title" className="text-sm font-medium tracking-tight">
              Import inventory from Excel
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Column A: product · Column B: serial. Link each row to a PO or Without PO.
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
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 cursor-pointer transition-colors duration-200"
                disabled={busy}
                onClick={() => importRef.current?.click()}
              >
                <Upload className="mr-1.5 size-3.5" />
                Choose Excel
              </Button>
              <input
                ref={importRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void onFileSelected(file);
                }}
              />
              {rows.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-muted-foreground">Apply PO to all</label>
                  <select
                    className="h-8 max-w-[220px] cursor-pointer rounded-md border border-border bg-background px-2 text-xs"
                    value={bulkPoId}
                    disabled={busy}
                    onChange={(e) => setBulkPoId(e.target.value)}
                  >
                    <option value={INVENTORY_WITHOUT_PO}>Without PO</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>
                        {poLabel(po)}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 cursor-pointer text-xs transition-colors duration-200"
                    disabled={busy}
                    onClick={applyBulkPo}
                  >
                    Apply
                  </Button>
                </div>
              ) : null}
            </div>

            {displayError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {displayError}
              </div>
            ) : null}

            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Upload a sheet with product names and serial numbers to assign PO links.
              </p>
            ) : (
              <div className={procurementUi.tableShell}>
                <div className={procurementUi.tableScroll}>
                  <table className={cn(procurementUi.table, "min-w-[640px]")}>
                    <thead className={procurementUi.thead}>
                      <tr>
                        <th className={procurementUi.th}>Product</th>
                        <th className={procurementUi.th}>Serial</th>
                        <th className={procurementUi.th}>Purchase order</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className={procurementUi.tr}>
                          <td className={procurementUi.td}>{row.product}</td>
                          <td className={cn(procurementUi.td, "font-mono text-xs")}>{row.serial}</td>
                          <td className={procurementUi.td}>
                            <select
                              className="h-8 w-full min-w-[160px] max-w-[240px] cursor-pointer rounded-md border border-border bg-background px-2 text-xs"
                              value={row.orderId}
                              disabled={busy}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id ? { ...r, orderId: e.target.value } : r,
                                  ),
                                )
                              }
                            >
                              <option value={INVENTORY_WITHOUT_PO}>Without PO</option>
                              {purchaseOrders.map((po) => (
                                <option key={po.id} value={po.id}>
                                  {poLabel(po)}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer transition-colors duration-200"
            disabled={busy || rows.length === 0}
            onClick={onSave}
          >
            {busy ? "Saving…" : "Save to inventory"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
