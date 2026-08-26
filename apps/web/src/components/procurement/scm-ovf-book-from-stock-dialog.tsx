"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Package, RefreshCw, ShoppingCart, X } from "lucide-react";

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
  ovfCreatePoRemainderHref,
  ovfDemandLines,
  ovfLineIsInventoryFulfillment,
  ovfProductKey,
  setOvfPoRemainderProducts,
} from "@/utils/ovf-stock";

function unitQty(row: ProcurementInventoryRow): number {
  return Number(row.received_quantity) || 1;
}

function unitLabel(row: ProcurementInventoryRow): string {
  const product = (row.product_name || "—").trim() || "—";
  const serial = (row.serial_number || "").trim();
  const grn = (row.grn_number || "").trim();
  const parts = [product];
  if (serial && serial !== "—" && serial !== "-") parts.push(`SN ${serial}`);
  if (grn) parts.push(grn);
  return parts.join(" · ");
}

type ScmOvfBookFromStockDialogProps = {
  open: boolean;
  ovfId: string;
  productName?: string | null;
  onClose: () => void;
  onBooked: () => void;
};

export function ScmOvfBookFromStockDialog({
  open,
  ovfId,
  productName,
  onClose,
  onBooked,
}: ScmOvfBookFromStockDialogProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [preview, setPreview] = useState<ScmOvfPreview | null>(null);
  const [inventory, setInventory] = useState<ProcurementInventoryRow[]>([]);
  /** demandProductKey → selected stock_unit_ids (in order). */
  const [selectedByDemand, setSelectedByDemand] = useState<Record<string, string[]>>({});
  const [orderPoByProduct, setOrderPoByProduct] = useState<Record<string, boolean>>({});
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
      const units = stock.filter((row) => row.source === "grn" && row.stock_unit_id);
      setPreview(ovf);
      setInventory(units);
      setSelectedByDemand({});

      const demand = ovfDemandLines(ovf);
      const avail = ovf.stock_availability || [];
      const poDefaults: Record<string, boolean> = {};
      const autoSelect: Record<string, string[]> = {};

      for (const line of demand) {
        if (!ovfLineIsInventoryFulfillment(line)) continue;
        const key = ovfProductKey(line.product_name);
        if (!key) continue;
        const stockRow = findStockAvailability(avail, line.product_name);
        const remaining = Number(stockRow?.remaining_qty ?? line.qty) || 0;
        if (remaining <= 0) continue;
        const exact = units.filter((row) => ovfProductKey(row.product_name) === key);
        poDefaults[key] = exact.length === 0;
        // Prefill exact name matches up to remaining need.
        if (exact.length > 0) {
          const picked: string[] = [];
          let running = 0;
          for (const unit of exact) {
            if (!unit.stock_unit_id) continue;
            if (running + unitQty(unit) > remaining + 1e-6) continue;
            picked.push(unit.stock_unit_id);
            running += unitQty(unit);
            if (running >= remaining - 1e-6) break;
          }
          if (picked.length > 0) autoSelect[key] = picked;
          if (running + 1e-6 >= remaining) poDefaults[key] = false;
        }
      }
      setOrderPoByProduct(poDefaults);
      setSelectedByDemand(autoSelect);
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
    const inventoryOpen = demand.filter((line) => {
      if (!ovfLineIsInventoryFulfillment(line)) return false;
      const stock = findStockAvailability(availability, line.product_name);
      return (Number(stock?.remaining_qty ?? line.qty) || 0) > 0;
    });
    const anyOpen =
      inventoryOpen.length > 0
        ? inventoryOpen
        : demand.filter((line) => {
            const stock = findStockAvailability(availability, line.product_name);
            return (Number(stock?.remaining_qty ?? line.qty) || 0) > 0;
          });
    const focus = (productName || "").trim().toLowerCase();
    if (!focus) return anyOpen;
    return [...anyOpen].sort((a, b) => {
      const aMatch = ovfProductKey(a.product_name) === focus ? 0 : 1;
      const bMatch = ovfProductKey(b.product_name) === focus ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [preview, productName, availability]);

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

  const usedUnitIds = useMemo(() => {
    const used = new Set<string>();
    for (const ids of Object.values(selectedByDemand)) {
      for (const id of ids) used.add(id);
    }
    return used;
  }, [selectedByDemand]);

  const inventoryById = useMemo(() => {
    const map = new Map<string, ProcurementInventoryRow>();
    for (const row of inventory) {
      if (row.stock_unit_id) map.set(row.stock_unit_id, row);
    }
    return map;
  }, [inventory]);

  function pickedQty(demandKey: string): number {
    return (selectedByDemand[demandKey] || []).reduce((sum, id) => {
      const unit = inventoryById.get(id);
      return sum + (unit ? unitQty(unit) : 1);
    }, 0);
  }

  function setDemandSelection(demandKey: string, demandName: string, unitIds: string[]) {
    const remaining = remainingByDemand.get(demandKey) || 0;
    let running = 0;
    const capped: string[] = [];
    for (const id of unitIds) {
      const unit = inventoryById.get(id);
      const qty = unit ? unitQty(unit) : 1;
      if (running + qty > remaining + 1e-6) break;
      capped.push(id);
      running += qty;
    }
    setSelectedByDemand((current) => ({ ...current, [demandKey]: capped }));
    setOrderPoByProduct((current) => ({
      ...current,
      [demandKey]:
        running + 1e-6 >= remaining
          ? false
          : capped.length === 0
            ? Boolean(current[demandKey]) || true
            : Boolean(current[demandKey]),
    }));
    void demandName;
  }

  function onPickUnit(demandKey: string, demandName: string, unitId: string) {
    if (!unitId) {
      setDemandSelection(demandKey, demandName, []);
      return;
    }
    const remaining = remainingByDemand.get(demandKey) || 0;
    const current = selectedByDemand[demandKey] || [];
    if (current.includes(unitId)) return;
    const unit = inventoryById.get(unitId);
    const qty = unit ? unitQty(unit) : 1;
    const already = pickedQty(demandKey);
    if (already + qty > remaining + 1e-6) {
      setError(`Need is ${remaining} for "${demandName}". Remove a selection or pick a smaller unit.`);
      return;
    }
    setError(null);
    // Single-slot when need is 1; otherwise append until filled.
    if (remaining <= 1 + 1e-6) {
      setDemandSelection(demandKey, demandName, [unitId]);
    } else {
      setDemandSelection(demandKey, demandName, [...current, unitId]);
    }
  }

  function removeUnit(demandKey: string, demandName: string, unitId: string) {
    setDemandSelection(
      demandKey,
      demandName,
      (selectedByDemand[demandKey] || []).filter((id) => id !== unitId),
    );
  }

  const selectedTotal = useMemo(
    () => Object.values(selectedByDemand).reduce((sum, ids) => sum + ids.length, 0),
    [selectedByDemand],
  );

  const poSelectedCount = useMemo(
    () =>
      demandLines.filter((line) => orderPoByProduct[ovfProductKey(line.product_name)]).length,
    [demandLines, orderPoByProduct],
  );

  const confirmLabel = useMemo(() => {
    if (busy) {
      if (selectedTotal > 0 && poSelectedCount > 0) return "Booking & opening PO…";
      if (poSelectedCount > 0) return "Opening PO…";
      return "Booking…";
    }
    if (selectedTotal > 0 && poSelectedCount > 0) return "Book stock & create PO";
    if (poSelectedCount > 0) return "Create combined PO";
    return "Confirm booking";
  }, [busy, selectedTotal, poSelectedCount]);

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
    const wantsPo = poSelectedCount > 0;

    if (stockPayload.length === 0 && !wantsPo) {
      setError("Select inventory for at least one item, or mark items to order on a PO.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (stockPayload.length > 0) {
        await fulfillOvfFromStock(ovfId, stockPayload);
        onBooked();
      }
      if (wantsPo) {
        const poProducts = demandLines
          .filter((line) => orderPoByProduct[ovfProductKey(line.product_name)])
          .map((line) => line.product_name);
        setOvfPoRemainderProducts(ovfId, poProducts);
        onClose();
        router.push(ovfCreatePoRemainderHref(ovfId));
        return;
      }
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
        className="flex max-h-[min(40rem,calc(100dvh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-lg"
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
                  ? `${preview.ovf_no} · pick inventory for each OVF item${
                      titleProduct ? ` · opened on ${titleProduct}` : ""
                    }`
                  : "Pick inventory for each OVF item"}
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
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium">Item</th>
                    <th className="px-3 py-2.5 text-right font-medium">Need</th>
                    <th className="px-3 py-2.5 text-left font-medium">From inventory</th>
                    <th className="px-3 py-2.5 text-left font-medium">Order PO</th>
                  </tr>
                </thead>
                <tbody>
                  {demandLines.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        No open demand left on this OVF.
                      </td>
                    </tr>
                  ) : inventory.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        No inventory stock available. Mark items for PO, or receive stock first.
                      </td>
                    </tr>
                  ) : (
                    demandLines.map((line) => {
                      const key = ovfProductKey(line.product_name);
                      const remaining = remainingByDemand.get(key) || 0;
                      const selected = selectedByDemand[key] || [];
                      const covered = pickedQty(key);
                      const orderPo = Boolean(orderPoByProduct[key]);
                      const focused =
                        titleProduct && ovfProductKey(titleProduct) === key;
                      const primarySelected = selected[0] || "";
                      const availableOptions = inventory.filter((row) => {
                        const id = row.stock_unit_id;
                        if (!id) return false;
                        if (selected.includes(id)) return true;
                        return !usedUnitIds.has(id);
                      });

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
                            <div className="space-y-2">
                              <select
                                aria-label={`Inventory for ${line.product_name}`}
                                className="h-8 w-full max-w-md cursor-pointer rounded-md border border-border bg-background px-2 text-xs transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                                value={remaining <= 1 + 1e-6 ? primarySelected : ""}
                                disabled={busy || remaining <= 0}
                                onChange={(event) =>
                                  onPickUnit(key, line.product_name, event.target.value)
                                }
                              >
                                <option value="">
                                  {remaining <= 1 + 1e-6
                                    ? "Select inventory item…"
                                    : covered >= remaining - 1e-6
                                      ? "Need filled"
                                      : "Add inventory item…"}
                                </option>
                                {availableOptions.map((row) => {
                                  const id = row.stock_unit_id!;
                                  const exact =
                                    ovfProductKey(row.product_name) === key;
                                  return (
                                    <option key={id} value={id} disabled={selected.includes(id)}>
                                      {unitLabel(row)}
                                      {!exact ? " (name differs)" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                              {selected.length > 0 ? (
                                <ul className="space-y-1">
                                  {selected.map((id) => {
                                    const unit = inventoryById.get(id);
                                    return (
                                      <li
                                        key={id}
                                        className="flex items-center justify-between gap-2 rounded border border-border/70 bg-muted/30 px-2 py-1 text-[11px]"
                                      >
                                        <span className="min-w-0 truncate font-mono">
                                          {unit ? unitLabel(unit) : id}
                                        </span>
                                        <button
                                          type="button"
                                          className="shrink-0 cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-destructive"
                                          disabled={busy}
                                          onClick={() =>
                                            removeUnit(key, line.product_name, id)
                                          }
                                        >
                                          Remove
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <p className="text-[11px] text-muted-foreground">
                                  Choose any inventory unit — names do not need to match.
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <label className="flex cursor-pointer items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                className="size-3.5 cursor-pointer accent-foreground"
                                checked={orderPo}
                                disabled={busy || covered + 1e-6 >= remaining}
                                onChange={(event) =>
                                  setOrderPoByProduct((current) => ({
                                    ...current,
                                    [key]: event.target.checked,
                                  }))
                                }
                              />
                              Include on PO
                            </label>
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
            disabled={loading || busy || (selectedTotal === 0 && poSelectedCount === 0)}
            onClick={() => void onConfirm()}
          >
            {poSelectedCount > 0 && selectedTotal === 0 ? (
              <ShoppingCart className="mr-1.5 size-3.5" />
            ) : (
              <Package className="mr-1.5 size-3.5" />
            )}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
