"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Package, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiClientError, formatApiError } from "@/services/api-client";
import {
  fulfillOvfFromStock,
  getScmOvfPreview,
  listProcurementInventory,
  type ProcurementInventoryRow,
  type ScmOvfPreview,
  type ScmVendorLine,
} from "@/services/procurement-service";
import {
  findStockAvailability,
  ovfDemandLines,
  ovfLineIsInventoryFulfillment,
  ovfProductKey,
} from "@/utils/ovf-stock";
import {
  groupGrnStockByProduct,
  isInventoryLedgerRow,
  nonBilledStockQuantity,
  type GrnStockByProductRow,
} from "@/utils/procurement-inventory-report";

function unitQty(row: ProcurementInventoryRow): number {
  const qty = nonBilledStockQuantity(row);
  return qty > 0 ? qty : Number(row.received_quantity) || 1;
}

type ScmOvfBookFromStockDialogProps = {
  open: boolean;
  ovfId: string;
  /** Optional focus product (sorted first). */
  productName?: string | null;
  /**
   * When set, only these OVF products appear (e.g. item-plan lines with distributor IN STOCK).
   * Empty array → no bookable lines.
   */
  allowedProductNames?: string[] | null;
  onClose: () => void;
  onBooked: () => void;
};

export function ScmOvfBookFromStockDialog({
  open,
  ovfId,
  productName,
  allowedProductNames,
  onClose,
  onBooked,
}: ScmOvfBookFromStockDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [preview, setPreview] = useState<ScmOvfPreview | null>(null);
  const [inventory, setInventory] = useState<ProcurementInventoryRow[]>([]);
  /** demandProductKey → selected stock_unit_ids (in order). */
  const [selectedByDemand, setSelectedByDemand] = useState<Record<string, string[]>>({});
  /** demandProductKey → inventory product key chosen in the dropdown. */
  const [pickedProductByDemand, setPickedProductByDemand] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovf, stock] = await Promise.all([
        getScmOvfPreview(ovfId),
        listProcurementInventory(),
      ]);
      // Same ledger as Procurement → Inventory; only units with stock_unit_id can be booked.
      const units = stock.filter(
        (row) =>
          isInventoryLedgerRow(row) &&
          row.source !== "grn_reversal" &&
          Boolean(row.stock_unit_id) &&
          nonBilledStockQuantity(row) > 0,
      );
      setPreview(ovf);
      setInventory(units);
      setSelectedByDemand({});
      setPickedProductByDemand({});

      const demand = ovfDemandLines(ovf);
      const avail = ovf.stock_availability || [];
      const autoSelect: Record<string, string[]> = {};
      const autoProduct: Record<string, string> = {};

      for (const line of demand) {
        if (!ovfLineIsInventoryFulfillment(line)) continue;
        const key = ovfProductKey(line.product_name);
        if (!key) continue;
        const stockRow = findStockAvailability(avail, line.product_name);
        const remaining = Number(stockRow?.remaining_qty ?? line.qty) || 0;
        if (remaining <= 0) continue;
        const exact = units.filter((row) => ovfProductKey(row.product_name) === key);
        if (exact.length === 0) continue;
        const picked: string[] = [];
        let running = 0;
        for (const unit of exact) {
          if (!unit.stock_unit_id) continue;
          const qty = unitQty(unit);
          if (running + qty > remaining + 1e-6) continue;
          picked.push(unit.stock_unit_id);
          running += qty;
          if (running >= remaining - 1e-6) break;
        }
        if (picked.length > 0) {
          autoSelect[key] = picked;
          autoProduct[key] = key;
        }
      }
      setSelectedByDemand(autoSelect);
      setPickedProductByDemand(autoProduct);
    } catch (err) {
      setError(formatApiError(err, "Failed to load inventory for booking"));
    } finally {
      setLoading(false);
    }
  }, [ovfId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const availability = preview?.stock_availability || [];

  const demandLines = useMemo(() => {
    if (!preview) return [] as ScmVendorLine[];
    const demand = ovfDemandLines(preview);
    const allowedKeys = new Set(
      (allowedProductNames || []).map((name) => ovfProductKey(name)).filter(Boolean),
    );
    const restrictToAllowed = allowedProductNames != null;

    const withRemaining = (line: ScmVendorLine) => {
      const stock = findStockAvailability(availability, line.product_name);
      return (Number(stock?.remaining_qty ?? line.qty) || 0) > 0;
    };

    let rows: ScmVendorLine[];
    if (restrictToAllowed) {
      rows = demand.filter((line) => {
        if (allowedKeys.size === 0) return false;
        if (!allowedKeys.has(ovfProductKey(line.product_name))) return false;
        return withRemaining(line);
      });
    } else {
      const inventoryOpen = demand.filter(
        (line) => ovfLineIsInventoryFulfillment(line) && withRemaining(line),
      );
      rows =
        inventoryOpen.length > 0
          ? inventoryOpen
          : demand.filter((line) => withRemaining(line));
    }

    const focus = (productName || "").trim().toLowerCase();
    if (!focus) return rows;
    return [...rows].sort((a, b) => {
      const aMatch = ovfProductKey(a.product_name) === focus ? 0 : 1;
      const bMatch = ovfProductKey(b.product_name) === focus ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [preview, productName, allowedProductNames, availability]);

  const remainingByDemand = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of demandLines) {
      const stock = findStockAvailability(availability, line.product_name);
      map.set(
        ovfProductKey(line.product_name),
        Number(stock?.remaining_qty ?? line.qty) || 0,
      );
    }
    return map;
  }, [demandLines, availability]);

  const inventoryById = useMemo(() => {
    const map = new Map<string, ProcurementInventoryRow>();
    for (const row of inventory) {
      if (row.stock_unit_id) map.set(row.stock_unit_id, row);
    }
    return map;
  }, [inventory]);

  const usedUnitIds = useMemo(() => {
    const used = new Set<string>();
    for (const ids of Object.values(selectedByDemand)) {
      for (const id of ids) used.add(id);
    }
    return used;
  }, [selectedByDemand]);

  /** Aggregated inventory products (name + qty) — same grouping as Inventory page. */
  const inventoryProducts = useMemo(
    () => groupGrnStockByProduct(inventory).filter((row) => row.stockQty > 0),
    [inventory],
  );

  const inventoryProductByKey = useMemo(() => {
    const map = new Map<string, GrnStockByProductRow>();
    for (const row of inventoryProducts) map.set(row.productKey, row);
    return map;
  }, [inventoryProducts]);

  function availableQtyForProduct(productKey: string, demandKey: string): number {
    const group = inventoryProductByKey.get(productKey);
    if (!group) return 0;
    const selectedHere = new Set(selectedByDemand[demandKey] || []);
    return group.lines.reduce((sum, row) => {
      const id = row.stock_unit_id;
      if (!id) return sum;
      if (usedUnitIds.has(id) && !selectedHere.has(id)) return sum;
      return sum + unitQty(row);
    }, 0);
  }

  function pickedQty(demandKey: string): number {
    return (selectedByDemand[demandKey] || []).reduce((sum, id) => {
      const unit = inventoryById.get(id);
      return sum + (unit ? unitQty(unit) : 1);
    }, 0);
  }

  function pickUnitsForProduct(
    demandKey: string,
    inventoryProductKey: string,
    remaining: number,
  ): string[] {
    const group = inventoryProductByKey.get(inventoryProductKey);
    if (!group || remaining <= 0) return [];
    const selectedElsewhere = new Set<string>();
    for (const [key, ids] of Object.entries(selectedByDemand)) {
      if (key === demandKey) continue;
      for (const id of ids) selectedElsewhere.add(id);
    }
    const picked: string[] = [];
    let running = 0;
    for (const unit of group.lines) {
      const id = unit.stock_unit_id;
      if (!id || selectedElsewhere.has(id)) continue;
      const qty = unitQty(unit);
      if (qty <= 0) continue;
      if (running + qty > remaining + 1e-6) continue;
      picked.push(id);
      running += qty;
      if (running >= remaining - 1e-6) break;
    }
    return picked;
  }

  function onPickInventoryProduct(demandKey: string, demandName: string, inventoryProductKey: string) {
    if (!inventoryProductKey) {
      setSelectedByDemand((current) => ({ ...current, [demandKey]: [] }));
      setPickedProductByDemand((current) => {
        const next = { ...current };
        delete next[demandKey];
        return next;
      });
      return;
    }
    const remaining = remainingByDemand.get(demandKey) || 0;
    const available = availableQtyForProduct(inventoryProductKey, demandKey);
    if (available <= 0) {
      setError(`No available quantity left for that inventory product.`);
      return;
    }
    const units = pickUnitsForProduct(demandKey, inventoryProductKey, remaining);
    if (units.length === 0) {
      setError(
        `Could not allocate stock for "${demandName}". Available quantity may exceed unit sizes for the remaining need.`,
      );
      return;
    }
    setError(null);
    setSelectedByDemand((current) => ({ ...current, [demandKey]: units }));
    setPickedProductByDemand((current) => ({
      ...current,
      [demandKey]: inventoryProductKey,
    }));
  }

  const selectedTotal = useMemo(
    () => Object.values(selectedByDemand).reduce((sum, ids) => sum + ids.length, 0),
    [selectedByDemand],
  );

  async function onConfirm() {
    if (!preview) return;
    const stockPayload = demandLines
      .map((line) => {
        const key = ovfProductKey(line.product_name);
        return {
          product_name: line.product_name,
          stock_unit_ids: selectedByDemand[key] || [],
        };
      })
      .filter((line) => line.stock_unit_ids.length > 0);

    if (stockPayload.length === 0) {
      setError("Select inventory for at least one item.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await fulfillOvfFromStock(ovfId, stockPayload);
      onBooked();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : formatApiError(err, "Could not allocate stock. Refresh and try again."),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open || !mounted) return null;

  const titleProduct = (productName || "").trim();

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
        aria-labelledby="book-from-stock-dialog-title"
        className="flex max-h-[min(40rem,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40"
              aria-hidden
            >
              <Package className="size-4 text-foreground" />
            </span>
            <div className="min-w-0">
              <h2
                id="book-from-stock-dialog-title"
                className="text-sm font-semibold leading-none tracking-tight text-foreground"
              >
                Book from inventory
              </h2>
              <p className="mt-1.5 text-xs font-normal text-muted-foreground">
                {preview
                  ? `${preview.ovf_no} · pick inventory products for IN STOCK items${
                      titleProduct ? ` · opened on ${titleProduct}` : ""
                    }`
                  : "Pick inventory products for IN STOCK items"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer transition-colors duration-200"
              disabled={loading || busy}
              onClick={() => void load()}
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 cursor-pointer transition-colors duration-200"
              aria-label="Close"
              disabled={busy}
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {loading && !preview ? (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              Loading stock…
            </div>
          ) : null}

          {preview ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium">Item</th>
                    <th className="px-3 py-2.5 text-right font-medium">Need</th>
                    <th className="px-3 py-2.5 text-left font-medium">From inventory</th>
                  </tr>
                </thead>
                <tbody>
                  {demandLines.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                        No IN STOCK products left to book on this OVF.
                      </td>
                    </tr>
                  ) : inventoryProducts.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                        No inventory stock available. Receive or add stock first.
                      </td>
                    </tr>
                  ) : (
                    demandLines.map((line) => {
                      const key = ovfProductKey(line.product_name);
                      const remaining = remainingByDemand.get(key) || 0;
                      const covered = pickedQty(key);
                      const focused = titleProduct && ovfProductKey(titleProduct) === key;
                      const selectedProductKey = pickedProductByDemand[key] || "";

                      return (
                        <tr
                          key={line.line_id || key}
                          className={`border-b border-border/70 align-top ${
                            focused ? "bg-sky-50/50" : ""
                          }`}
                        >
                          <td className="px-3 py-3">
                            <p className="font-medium text-foreground">{line.product_name}</p>
                            {covered > 0 ? (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                Picked {covered} of {remaining}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{remaining}</td>
                          <td className="px-3 py-3">
                            <select
                              aria-label={`Inventory for ${line.product_name}`}
                              className="h-8 w-full max-w-md cursor-pointer rounded-md border border-border bg-background px-2 text-xs transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                              value={selectedProductKey}
                              disabled={busy || remaining <= 0}
                              onChange={(event) =>
                                onPickInventoryProduct(key, line.product_name, event.target.value)
                              }
                            >
                              <option value="">Select inventory product…</option>
                              {inventoryProducts.map((row) => {
                                const available = availableQtyForProduct(row.productKey, key);
                                const selectedHere = selectedProductKey === row.productKey;
                                const qtyLabel = selectedHere
                                  ? Math.max(available, covered)
                                  : available;
                                return (
                                  <option
                                    key={row.productKey}
                                    value={row.productKey}
                                    disabled={!selectedHere && available <= 0}
                                  >
                                    {row.productName} · Qty {qtyLabel}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 px-5 py-3">
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
            disabled={loading || busy || selectedTotal === 0}
            onClick={() => void onConfirm()}
          >
            <Package className="mr-1.5 size-3.5" />
            {busy ? "Booking…" : "Confirm booking"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
