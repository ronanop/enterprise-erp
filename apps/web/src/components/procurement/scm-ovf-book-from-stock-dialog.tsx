"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Package, Plus, RefreshCw, X } from "lucide-react";

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
import { cn } from "@/lib/utils";

function unitQty(row: ProcurementInventoryRow): number {
  const qty = nonBilledStockQuantity(row);
  return qty > 0 ? qty : Number(row.received_quantity) || 1;
}

/** demandKey → inventoryProductKey → requested qty */
type ProductQtyPicks = Record<string, Record<string, number>>;

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
  /** demandProductKey → inventory product key → qty to take from that product. */
  const [pickedQtyByDemand, setPickedQtyByDemand] = useState<ProductQtyPicks>({});
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

  const inventoryById = useMemo(() => {
    const map = new Map<string, ProcurementInventoryRow>();
    for (const row of inventory) {
      if (row.stock_unit_id) map.set(row.stock_unit_id, row);
    }
    return map;
  }, [inventory]);

  const inventoryProducts = useMemo(
    () => groupGrnStockByProduct(inventory).filter((row) => row.stockQty > 0),
    [inventory],
  );

  const inventoryProductByKey = useMemo(() => {
    const map = new Map<string, GrnStockByProductRow>();
    for (const row of inventoryProducts) map.set(row.productKey, row);
    return map;
  }, [inventoryProducts]);

  const usedUnitIds = useMemo(() => {
    const used = new Set<string>();
    for (const ids of Object.values(selectedByDemand)) {
      for (const id of ids) used.add(id);
    }
    return used;
  }, [selectedByDemand]);

  function availableQtyForProduct(
    productKey: string,
    demandKey: string,
  ): number {
    const group = inventoryProductByKey.get(productKey);
    if (!group) return 0;
    const selectedOnThisDemand = new Set(selectedByDemand[demandKey] || []);
    return group.lines.reduce((sum, row) => {
      const id = row.stock_unit_id;
      if (!id) return sum;
      // Free for anyone, or already held by this demand line (editable).
      if (usedUnitIds.has(id) && !selectedOnThisDemand.has(id)) return sum;
      return sum + unitQty(row);
    }, 0);
  }

  function pickUnitsForQty(
    inventoryProductKey: string,
    targetQty: number,
    reserved: Set<string>,
  ): { ids: string[]; allocated: number } {
    if (targetQty <= 0) return { ids: [], allocated: 0 };
    const group = inventoryProductByKey.get(inventoryProductKey);
    if (!group) return { ids: [], allocated: 0 };
    const picked: string[] = [];
    let running = 0;
    for (const unit of group.lines) {
      const id = unit.stock_unit_id;
      if (!id || reserved.has(id)) continue;
      const qty = unitQty(unit);
      if (qty <= 0) continue;
      if (running + qty > targetQty + 1e-6) continue;
      picked.push(id);
      reserved.add(id);
      running += qty;
      if (running >= targetQty - 1e-6) break;
    }
    return { ids: picked, allocated: running };
  }

  function rebuildUnitsForDemand(
    demandKey: string,
    picks: Record<string, number>,
    allSelected: Record<string, string[]>,
  ): { ids: string[]; normalizedPicks: Record<string, number> } {
    const reserved = new Set<string>();
    for (const [key, ids] of Object.entries(allSelected)) {
      if (key === demandKey) continue;
      for (const id of ids) reserved.add(id);
    }
    const ids: string[] = [];
    const normalizedPicks: Record<string, number> = {};
    for (const [productKey, qty] of Object.entries(picks)) {
      if (!productKey || qty <= 0) continue;
      const { ids: unitIds, allocated } = pickUnitsForQty(productKey, qty, reserved);
      if (allocated > 0 && unitIds.length > 0) {
        normalizedPicks[productKey] = allocated;
        ids.push(...unitIds);
      }
    }
    return { ids, normalizedPicks };
  }

  function pickedQty(demandKey: string): number {
    return (selectedByDemand[demandKey] || []).reduce((sum, id) => {
      const unit = inventoryById.get(id);
      return sum + (unit ? unitQty(unit) : 1);
    }, 0);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovf, stock] = await Promise.all([
        getScmOvfPreview(ovfId),
        listProcurementInventory(),
      ]);
      const units = stock.filter(
        (row) =>
          isInventoryLedgerRow(row) &&
          row.source !== "grn_reversal" &&
          Boolean(row.stock_unit_id) &&
          nonBilledStockQuantity(row) > 0,
      );
      setPreview(ovf);
      setInventory(units);

      const demand = ovfDemandLines(ovf);
      const avail = ovf.stock_availability || [];
      const autoSelect: Record<string, string[]> = {};
      const autoPicks: ProductQtyPicks = {};
      const groups = groupGrnStockByProduct(units).filter((row) => row.stockQty > 0);
      const groupByKey = new Map(groups.map((row) => [row.productKey, row]));

      for (const line of demand) {
        if (!ovfLineIsInventoryFulfillment(line)) continue;
        const key = ovfProductKey(line.product_name);
        if (!key) continue;
        const stockRow = findStockAvailability(avail, line.product_name);
        const remaining = Number(stockRow?.remaining_qty ?? line.qty) || 0;
        if (remaining <= 0) continue;
        const exact = groupByKey.get(key);
        if (!exact) continue;
        const reserved = new Set<string>();
        for (const ids of Object.values(autoSelect)) {
          for (const id of ids) reserved.add(id);
        }
        const { ids, allocated } = (() => {
          const picked: string[] = [];
          let running = 0;
          for (const unit of exact.lines) {
            const id = unit.stock_unit_id;
            if (!id || reserved.has(id)) continue;
            const qty = unitQty(unit);
            if (qty <= 0) continue;
            if (running + qty > remaining + 1e-6) continue;
            picked.push(id);
            running += qty;
            if (running >= remaining - 1e-6) break;
          }
          return { ids: picked, allocated: running };
        })();
        if (ids.length > 0 && allocated > 0) {
          autoSelect[key] = ids;
          autoPicks[key] = { [key]: allocated };
        }
      }
      setSelectedByDemand(autoSelect);
      setPickedQtyByDemand(autoPicks);
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

  function applyPicks(demandKey: string, nextPicks: Record<string, number>) {
    const remaining = remainingByDemand.get(demandKey) || 0;
    const cleaned: Record<string, number> = {};
    let runningNeed = remaining;
    for (const [productKey, rawQty] of Object.entries(nextPicks)) {
      if (!productKey) continue;
      const qty = Math.max(0, Number(rawQty) || 0);
      if (qty <= 0) continue;
      cleaned[productKey] = Math.min(qty, runningNeed);
      runningNeed = Math.max(0, runningNeed - cleaned[productKey]);
    }

    setSelectedByDemand((currentSelected) => {
      const { ids, normalizedPicks } = rebuildUnitsForDemand(
        demandKey,
        cleaned,
        currentSelected,
      );
      setPickedQtyByDemand((current) => {
        const next = { ...current };
        if (Object.keys(normalizedPicks).length === 0) {
          delete next[demandKey];
        } else {
          next[demandKey] = normalizedPicks;
        }
        return next;
      });
      if (Object.keys(normalizedPicks).length < Object.keys(cleaned).length) {
        setError(
          "Some quantities could not be allocated from whole stock units. Quantity was adjusted to what inventory allows.",
        );
      } else {
        setError(null);
      }
      return { ...currentSelected, [demandKey]: ids };
    });
  }

  function onAddInventoryProduct(demandKey: string, inventoryProductKey: string) {
    if (!inventoryProductKey) return;
    const current = { ...(pickedQtyByDemand[demandKey] || {}) };
    if (current[inventoryProductKey] != null) return;
    const remaining = remainingByDemand.get(demandKey) || 0;
    const covered = Object.values(current).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
    const needLeft = Math.max(0, remaining - covered);
    if (needLeft <= 0) {
      setError("Need quantity is already fully covered for this item.");
      return;
    }
    const available = availableQtyForProduct(inventoryProductKey, demandKey);
    if (available <= 0) {
      setError("No available quantity left for that inventory product.");
      return;
    }
    const startQty = Math.min(1, needLeft, available);
    // Prefer at least one whole unit if unit size > 1.
    const group = inventoryProductByKey.get(inventoryProductKey);
    const firstUnitQty = group?.lines
      .map((row) => unitQty(row))
      .find((qty) => qty > 0);
    const initial =
      firstUnitQty && firstUnitQty <= needLeft && firstUnitQty <= available
        ? Math.min(firstUnitQty, needLeft, available)
        : startQty;
    applyPicks(demandKey, { ...current, [inventoryProductKey]: Math.max(initial, startQty) });
  }

  function onChangeProductQty(demandKey: string, inventoryProductKey: string, nextQty: number) {
    const current = { ...(pickedQtyByDemand[demandKey] || {}) };
    const available = availableQtyForProduct(inventoryProductKey, demandKey);
    const remaining = remainingByDemand.get(demandKey) || 0;
    const others = Object.entries(current)
      .filter(([key]) => key !== inventoryProductKey)
      .reduce((sum, [, qty]) => sum + (Number(qty) || 0), 0);
    const maxForThis = Math.max(0, Math.min(available, remaining - others));
    const clamped = Math.max(0, Math.min(nextQty, maxForThis));
    if (clamped <= 0) {
      delete current[inventoryProductKey];
    } else {
      current[inventoryProductKey] = clamped;
    }
    applyPicks(demandKey, current);
  }

  function onRemoveProduct(demandKey: string, inventoryProductKey: string) {
    const current = { ...(pickedQtyByDemand[demandKey] || {}) };
    delete current[inventoryProductKey];
    applyPicks(demandKey, current);
  }

  function stepProductQty(demandKey: string, inventoryProductKey: string, delta: number) {
    const currentQty = Number(pickedQtyByDemand[demandKey]?.[inventoryProductKey] || 0);
    const group = inventoryProductByKey.get(inventoryProductKey);
    const step =
      group?.lines.map((row) => unitQty(row)).find((qty) => qty > 0 && qty <= 1) ?? 1;
    onChangeProductQty(demandKey, inventoryProductKey, currentQty + delta * step);
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
                  ? `${preview.ovf_no} · pick one or more inventory products and set quantities${
                      titleProduct ? ` · opened on ${titleProduct}` : ""
                    }`
                  : "Pick inventory products and set quantities for IN STOCK items"}
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
              <table className="w-full min-w-[640px] text-sm">
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
                      const picks = pickedQtyByDemand[key] || {};
                      const selectedKeys = new Set(Object.keys(picks));
                      const addable = inventoryProducts.filter((row) => {
                        if (selectedKeys.has(row.productKey)) return false;
                        return availableQtyForProduct(row.productKey, key) > 0;
                      });

                      return (
                        <tr
                          key={line.line_id || key}
                          className={cn(
                            "border-b border-border/70 align-top",
                            focused && "bg-sky-50/50",
                          )}
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
                            <div className="flex max-w-lg flex-col gap-2">
                              {Object.entries(picks).map(([productKey, qty]) => {
                                const group = inventoryProductByKey.get(productKey);
                                const available = availableQtyForProduct(productKey, key);
                                const others = Object.entries(picks)
                                  .filter(([pk]) => pk !== productKey)
                                  .reduce((sum, [, q]) => sum + (Number(q) || 0), 0);
                                const maxForThis = Math.max(
                                  0,
                                  Math.min(available, remaining - others),
                                );
                                const canMinus = qty > 0 && !busy;
                                const canPlus = qty < maxForThis - 1e-6 && !busy;

                                return (
                                  <div
                                    key={productKey}
                                    className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-medium text-foreground">
                                        {group?.productName || productKey}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground">
                                        Available {available}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <button
                                        type="button"
                                        aria-label={`Decrease quantity for ${group?.productName || productKey}`}
                                        disabled={!canMinus}
                                        onClick={() => stepProductQty(key, productKey, -1)}
                                        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors duration-200 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        <Minus className="size-3.5" />
                                      </button>
                                      <input
                                        type="number"
                                        min={0}
                                        max={maxForThis}
                                        step="any"
                                        value={qty}
                                        disabled={busy}
                                        aria-label={`Quantity for ${group?.productName || productKey}`}
                                        onChange={(event) =>
                                          onChangeProductQty(
                                            key,
                                            productKey,
                                            Number(event.target.value) || 0,
                                          )
                                        }
                                        className="h-7 w-14 rounded-md border border-border bg-background px-1.5 text-center text-xs tabular-nums transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                      />
                                      <button
                                        type="button"
                                        aria-label={`Increase quantity for ${group?.productName || productKey}`}
                                        disabled={!canPlus}
                                        onClick={() => stepProductQty(key, productKey, 1)}
                                        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors duration-200 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        <Plus className="size-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label={`Remove ${group?.productName || productKey}`}
                                        disabled={busy}
                                        onClick={() => onRemoveProduct(key, productKey)}
                                        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors duration-200 hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        <X className="size-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                              <select
                                aria-label={`Add inventory product for ${line.product_name}`}
                                className="h-8 w-full cursor-pointer rounded-md border border-border bg-background px-2 text-xs transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                                value=""
                                disabled={busy || remaining <= 0 || addable.length === 0}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  event.target.value = "";
                                  onAddInventoryProduct(key, value);
                                }}
                              >
                                <option value="">
                                  {selectedKeys.size > 0
                                    ? "Add another inventory product…"
                                    : "Select inventory product…"}
                                </option>
                                {addable.map((row) => (
                                  <option key={row.productKey} value={row.productKey}>
                                    {row.productName} · available{" "}
                                    {availableQtyForProduct(row.productKey, key)}
                                  </option>
                                ))}
                              </select>
                            </div>
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
