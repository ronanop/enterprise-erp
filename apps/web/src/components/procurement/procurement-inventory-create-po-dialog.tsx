"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { FinanceField, FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  peekNextCompanyPoNumber,
  type ProcurementInventoryRow,
  type VendorOption,
} from "@/services/procurement-service";

const ENTITY_OPTIONS = [
  { value: "CDT", label: "Cache DigiTech Pvt. Ltd. (CDT)" },
  { value: "CT", label: "Cache Technologies (CT)" },
  { value: "CMT", label: "Cache DigiTech Pvt. Ltd. Mumbai (CMT)" },
] as const;

export type InventoryPoLinePayload = {
  product_name: string;
  quantity: number;
  unit_cost: number;
};

type ProcurementInventoryCreatePoDialogProps = {
  open: boolean;
  vendors: VendorOption[];
  stockRows: ProcurementInventoryRow[];
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (payload: {
    vendorId: string;
    entityCode: string;
    documentDate: string;
    lines: InventoryPoLinePayload[];
  }) => void;
};

function stockRowKey(row: ProcurementInventoryRow, index: number): string {
  return `${row.grn_number}-${row.company_po_number}-${row.line_number}-${row.unit_index}-${index}`;
}

function aggregateSelectedLines(
  allRows: ProcurementInventoryRow[],
  selectedKeys: Set<string>,
): InventoryPoLinePayload[] {
  const byProduct = new Map<string, { quantity: number; unit_cost: number }>();
  for (let index = 0; index < allRows.length; index += 1) {
    const row = allRows[index];
    const key = stockRowKey(row, index);
    if (!selectedKeys.has(key)) continue;
    const name = (row.product_name || "").trim() || "Unnamed product";
    const entry = byProduct.get(name) ?? { quantity: 0, unit_cost: 0 };
    entry.quantity += 1;
    const cost = Number(row.unit_cost) || 0;
    if (cost > 0) entry.unit_cost = cost;
    byProduct.set(name, entry);
  }
  return Array.from(byProduct.entries()).map(([product_name, data]) => ({
    product_name,
    quantity: data.quantity,
    unit_cost: data.unit_cost,
  }));
}

export function ProcurementInventoryCreatePoDialog({
  open,
  vendors,
  stockRows,
  busy,
  error,
  onClose,
  onConfirm,
}: ProcurementInventoryCreatePoDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [entityCode, setEntityCode] = useState("CDT");
  const [documentDate, setDocumentDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [nextPo, setNextPo] = useState("");
  const [peekBusy, setPeekBusy] = useState(false);
  const [peekError, setPeekError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());

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
      setVendorId("");
      setEntityCode("CDT");
      setDocumentDate(new Date().toISOString().slice(0, 10));
      setNextPo("");
      setPeekError(null);
      setSelectedKeys(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setNextPo("");
    setPeekError(null);
    setPeekBusy(true);
    // Use session company scope (same as inventory list) — do not pass a random vendor company_id.
    void peekNextCompanyPoNumber(entityCode)
      .then((row) => {
        if (!cancelled) {
          setNextPo((row.company_po_number || "").trim());
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setNextPo("");
          setPeekError(
            err instanceof Error && err.message.trim()
              ? err.message
              : "Could not load the next PO number.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setPeekBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entityCode]);

  const selectedLines = useMemo(
    () => aggregateSelectedLines(stockRows, selectedKeys),
    [stockRows, selectedKeys],
  );

  const selectedUnitCount = selectedKeys.size;
  const allSelected =
    stockRows.length > 0 && stockRows.every((row, index) => selectedKeys.has(stockRowKey(row, index)));

  if (!open || !mounted) return null;

  function toggleRow(row: ProcurementInventoryRow, index: number) {
    const key = stockRowKey(row, index);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedKeys(new Set());
      return;
    }
    setSelectedKeys(
      new Set(stockRows.map((row, index) => stockRowKey(row, index))),
    );
  }

  function onCreate() {
    if (!vendorId) return;
    if (stockRows.length > 0 && selectedLines.length === 0) return;
    onConfirm({
      vendorId,
      entityCode,
      documentDate,
      lines: selectedLines,
    });
  }

  const canCreate =
    vendorId && (stockRows.length === 0 || selectedUnitCount > 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/40 p-4 sm:p-6"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-create-po-title"
        className="flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
          <div>
            <h2 id="inventory-create-po-title" className="text-base font-medium tracking-tight text-foreground">
              Create purchase order from stock
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose vendor and entity, then select stock units to add as PO lines.
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <div className="space-y-5">
            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FinanceField label="Entity">
                <FinanceSelect
                  value={entityCode}
                  onChange={(e) => setEntityCode(e.target.value)}
                  disabled={busy}
                >
                  {ENTITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </FinanceSelect>
              </FinanceField>

              <FinanceField
                label="PO number (auto)"
                hint={
                  peekError
                    ? undefined
                    : "Next number in the entity sequence when you create this PO."
                }
                error={peekError ?? undefined}
              >
                <Input
                  readOnly
                  className="h-8 font-mono text-sm font-medium tabular-nums text-foreground"
                  value={
                    peekBusy
                      ? "Loading next PO number…"
                      : nextPo || (peekError ? "—" : "Loading next PO number…")
                  }
                />
              </FinanceField>

              <FinanceField label="Vendor">
                <FinanceSelect
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select vendor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </FinanceSelect>
              </FinanceField>

              <FinanceField label="PO date">
                <Input
                  type="date"
                  className="h-8"
                  value={documentDate}
                  disabled={busy}
                  onChange={(e) => setDocumentDate(e.target.value)}
                />
              </FinanceField>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={procurementUi.sectionTitle}>Stock on hand</p>
                <p className="text-xs text-muted-foreground">
                  {selectedUnitCount} unit{selectedUnitCount === 1 ? "" : "s"} selected
                  {selectedLines.length > 0
                    ? ` · ${selectedLines.length} product line${selectedLines.length === 1 ? "" : "s"} on PO`
                    : ""}
                </p>
              </div>

              {stockRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No stock units available. Receive on a GRN with partial billing to add stock first.
                </p>
              ) : (
                <div className={procurementUi.tableShell}>
                  <div className={procurementUi.tableScroll}>
                    <table className={cn(procurementUi.table, "min-w-[800px]")}>
                      <thead className={procurementUi.thead}>
                        <tr>
                          <th className={cn(procurementUi.th, "w-12 text-center")}>
                            <input
                              type="checkbox"
                              className="size-4 cursor-pointer accent-primary"
                              checked={allSelected}
                              disabled={busy}
                              aria-label="Select all stock units"
                              onChange={toggleAll}
                            />
                          </th>
                          <th className={procurementUi.th}>Product</th>
                          <th className={procurementUi.th}>PO number</th>
                          <th className={procurementUi.th}>GRN number</th>
                          <th className={procurementUi.th}>Serial</th>
                          <th className={cn(procurementUi.th, "text-right")}>Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockRows.map((row, index) => {
                          const key = stockRowKey(row, index);
                          const checked = selectedKeys.has(key);
                          return (
                            <tr key={key} className={procurementUi.tr}>
                              <td className={cn(procurementUi.td, "text-center")}>
                                <input
                                  type="checkbox"
                                  className="size-4 cursor-pointer accent-primary"
                                  checked={checked}
                                  disabled={busy}
                                  aria-label={`Select ${row.product_name ?? "product"}`}
                                  onChange={() => toggleRow(row, index)}
                                />
                              </td>
                              <td className={cn(procurementUi.td, "font-medium text-foreground")}>
                                {row.product_name ?? "—"}
                              </td>
                              <td className={cn(procurementUi.td, "tabular-nums")}>
                                {row.company_po_number}
                              </td>
                              <td className={cn(procurementUi.td, "font-mono text-xs tabular-nums text-muted-foreground")}>
                                {row.grn_number}
                              </td>
                              <td className={cn(procurementUi.td, "font-mono text-xs")}>
                                {row.serial_number}
                              </td>
                              <td className={cn(procurementUi.tdNumeric, "text-right tabular-nums")}>
                                {row.unit_cost && row.unit_cost > 0 ? row.unit_cost : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border/60 px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            disabled={busy || !canCreate}
            onClick={onCreate}
          >
            {busy ? "Creating…" : "Create PO"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
