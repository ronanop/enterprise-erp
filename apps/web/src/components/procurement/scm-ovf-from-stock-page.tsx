"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError, formatApiError } from "@/services/api-client";
import {
  fulfillOvfFromStock,
  getScmOvfPreview,
  listProcurementInventory,
  type ProcurementInventoryRow,
  type ScmOvfPreview,
  type ScmStockAvailability,
} from "@/services/procurement-service";
import {
  findStockAvailability,
  ovfCreatePoRemainderHref,
  ovfProductKey,
  ovfStockChallanHref,
  ovfStockSourceKey,
} from "@/utils/ovf-stock";
import { addPendingGrnChallan } from "@/utils/grn-challan-pending";

function demandLines(preview: ScmOvfPreview) {
  return (preview.customer_lines?.length ? preview.customer_lines : preview.vendor_lines) || [];
}

function unitQty(row: ProcurementInventoryRow): number {
  return Number(row.received_quantity) || 1;
}

export function ScmOvfFromStockPage({ ovfId }: { ovfId: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<ScmOvfPreview | null>(null);
  const [inventory, setInventory] = useState<ProcurementInventoryRow[]>([]);
  const [selectedByProduct, setSelectedByProduct] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovf, stock] = await Promise.all([
        getScmOvfPreview(ovfId),
        listProcurementInventory(),
      ]);
      setPreview(ovf);
      setInventory(stock.filter((row) => row.source === "grn" && row.stock_unit_id));
    } catch (err) {
      setError(formatApiError(err, "Failed to load OVF stock availability"));
    } finally {
      setLoading(false);
    }
  }, [ovfId]);

  useEffect(() => {
    void load();
  }, [load]);

  const availability = preview?.stock_availability || [];

  const unitsByProduct = useMemo(() => {
    const map = new Map<string, ProcurementInventoryRow[]>();
    for (const row of inventory) {
      const key = ovfProductKey(row.product_name);
      if (!key || !row.stock_unit_id) continue;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [inventory]);

  function setUseQty(productName: string, remaining: number, units: ProcurementInventoryRow[], qty: number) {
    const key = ovfProductKey(productName);
    const capped = Math.max(0, Math.min(qty, remaining));
    const picked: string[] = [];
    let running = 0;
    for (const unit of units) {
      if (!unit.stock_unit_id) continue;
      if (running + unitQty(unit) > capped + 1e-6) continue;
      picked.push(unit.stock_unit_id);
      running += unitQty(unit);
      if (running >= capped - 1e-6) break;
    }
    setSelectedByProduct((current) => ({ ...current, [key]: picked }));
  }

  function toggleUnit(productName: string, remaining: number, unitId: string, qty: number) {
    const key = ovfProductKey(productName);
    setSelectedByProduct((current) => {
      const selected = new Set(current[key] || []);
      if (selected.has(unitId)) {
        selected.delete(unitId);
      } else {
        const nextQty =
          [...selected].reduce((sum, id) => {
            const row = inventory.find((item) => item.stock_unit_id === id);
            return sum + (row ? unitQty(row) : 0);
          }, 0) + qty;
        if (nextQty > remaining + 1e-6) return current;
        selected.add(unitId);
      }
      return { ...current, [key]: [...selected] };
    });
  }

  const selectedTotal = useMemo(() => {
    return Object.values(selectedByProduct).reduce((sum, ids) => sum + ids.length, 0);
  }, [selectedByProduct]);

  async function onConfirm() {
    if (!preview) return;
    const lines = demandLines(preview)
      .map((line) => {
        const key = ovfProductKey(line.product_name);
        return {
          product_name: line.product_name,
          stock_unit_ids: selectedByProduct[key] || [],
        };
      })
      .filter((line) => line.stock_unit_ids.length > 0);
    if (lines.length === 0) {
      setError("Select at least one stock unit.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await fulfillOvfFromStock(ovfId, lines);
      const prefill = result.challan_prefill;
      addPendingGrnChallan({
        orderId: ovfId,
        batchKey: prefill.source_key || ovfStockSourceKey(ovfId),
        grnNumber: "OVF stock",
        purchaseOrderNumber: prefill.po_number || preview.po_number || "",
        vendorName: preview.vendor_name || preview.oem_name || "—",
        customerName: prefill.customer_name || preview.customer_name || "",
        itemsSummary: prefill.lines
          .map((ln) => `${ln.product_name} × ${ln.quantity}`)
          .join(", "),
        kind: "delivery_challan",
        source: "ovf_stock",
      });
      router.push(ovfStockChallanHref(ovfId));
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

  return (
    <div className="space-y-4">
      <PageHeader
        title={preview ? `Fulfill ${preview.ovf_no} from inventory` : "Fulfill from inventory"}
        backHref={`/procurement/scm/ovf/${ovfId}`}
        backLabel="OVF"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading || busy}
              onClick={() => void load()}
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Refresh
            </Button>
            {preview?.can_create_po ? (
              <Link
                href={ovfCreatePoRemainderHref(ovfId)}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "cursor-pointer transition-colors duration-200",
                )}
              >
                Create PO for remainder
              </Link>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading || busy || selectedTotal === 0}
              onClick={() => void onConfirm()}
            >
              <Package className="mr-1.5 size-3.5" />
              {busy ? "Allocating…" : "Confirm allocation"}
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !preview ? (
        <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Loading stock against this OVF…
        </div>
      ) : null}

      {preview ? (
        <section className="space-y-3 rounded-lg border-2 border-foreground/20 bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold tracking-tight">Demand vs on-hand</h2>
          <p className="text-xs text-muted-foreground">
            Match is exact product name (trim + case-insensitive). Remaining quantity still uses Create PO.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Product</th>
                  <th className="px-3 py-2 text-right font-medium">Required</th>
                  <th className="px-3 py-2 text-right font-medium">On hand</th>
                  <th className="px-3 py-2 text-right font-medium">Allocated</th>
                  <th className="px-3 py-2 text-right font-medium">Remaining</th>
                  <th className="px-3 py-2 text-right font-medium">Use from stock</th>
                </tr>
              </thead>
              <tbody>
                {demandLines(preview).map((line) => {
                  const stock: ScmStockAvailability | undefined = findStockAvailability(
                    availability,
                    line.product_name,
                  );
                  const remaining = Number(stock?.remaining_qty ?? line.qty) || 0;
                  const onHand = Number(stock?.on_hand_qty) || 0;
                  const key = ovfProductKey(line.product_name);
                  const units = unitsByProduct.get(key) || [];
                  const selected = selectedByProduct[key] || [];
                  const useQty = selected.reduce((sum, id) => {
                    const row = units.find((unit) => unit.stock_unit_id === id);
                    return sum + (row ? unitQty(row) : 0);
                  }, 0);
                  const maxUse = Math.min(remaining, onHand);
                  return (
                    <tr key={line.line_id} className="border-b border-border/70 align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium">{line.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(line.description || "").trim() || "Customer ship qty"}
                        </p>
                        {units.length > 0 ? (
                          <ul className="mt-2 space-y-1">
                            {units.map((unit) => {
                              const id = unit.stock_unit_id!;
                              const checked = selected.includes(id);
                              return (
                                <li key={id}>
                                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                                    <input
                                      type="checkbox"
                                      className="cursor-pointer"
                                      checked={checked}
                                      disabled={busy || remaining <= 0}
                                      onChange={() =>
                                        toggleUnit(line.product_name, remaining, id, unitQty(unit))
                                      }
                                    />
                                    <span>
                                      {(unit.serial_number || "—").trim()} · qty {unitQty(unit)}
                                      {unit.grn_number ? ` · ${unit.grn_number}` : ""}
                                    </span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">No matching stock units.</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.qty}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{onHand}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {stock?.allocated_qty ?? 0}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{remaining}</td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={maxUse}
                          step="1"
                          value={String(useQty)}
                          disabled={busy || maxUse <= 0}
                          className="ml-auto h-8 w-20 cursor-text text-right"
                          onChange={(event) =>
                            setUseQty(
                              line.product_name,
                              remaining,
                              units,
                              Number(event.target.value) || 0,
                            )
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
