"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Package, RefreshCw, ShoppingCart, Truck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { ScmOvfBookFromStockDialog } from "@/components/procurement/scm-ovf-book-from-stock-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  getScmOvfPreview,
  type ScmOvfPreview,
} from "@/services/procurement-service";
import {
  ovfChallanHref,
  ovfCreatePoHref,
  ovfProductKey,
  type OvfChallanShipSource,
  type OvfShipDocumentKind,
} from "@/utils/ovf-stock";

function formatPlanQty(value: number | null | undefined): string {
  const n = Number(value) || 0;
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function deliveryStorageKey(ovfId: string): string {
  return `ovf-item-plan-delivery:${ovfId}`;
}

export function ScmOvfItemPlanPage({ ovfId }: { ovfId: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<ScmOvfPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<"together" | "separate">("together");
  const [shipKind, setShipKind] = useState<OvfShipDocumentKind>("delivery_challan");
  const [bookProductName, setBookProductName] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ovf = await getScmOvfPreview(ovfId);
      setPreview(ovf);
      const recommended = ovf.item_plan?.delivery === "separate" ? "separate" : "together";
      const stored =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(deliveryStorageKey(ovfId))
          : null;
      setDelivery(stored === "together" || stored === "separate" ? stored : recommended);
    } catch (err) {
      setError(formatApiError(err, "Failed to load item plan"));
    } finally {
      setLoading(false);
    }
  }, [ovfId]);

  useEffect(() => {
    void load();
  }, [load]);

  const lines = preview?.item_plan?.lines || [];
  const openDistributors = preview?.open_distributor_names || [];
  const bookedProducts = (preview?.stock_availability || []).filter(
    (row) => Number(row.allocated_qty) > 0,
  ).length;
  const hasInventoryTaken =
    bookedProducts > 0 || (preview?.stock_allocations || []).length > 0;
  const linkedPos = preview?.purchase_orders?.length
    ? preview.purchase_orders
    : preview?.purchase_order_id
      ? [{ id: preview.purchase_order_id, status: preview.purchase_order_status }]
      : [];
  const canShipInventory = hasInventoryTaken;
  const canShipPo = linkedPos.length > 0;
  const canShipCombined = canShipInventory && canShipPo;
  const showDelivery = hasInventoryTaken;
  const showTogetherSeparate = bookedProducts > 1 || (hasInventoryTaken && canShipPo);
  const onHold = Boolean(preview?.scm_on_hold);

  function chooseDelivery(next: "together" | "separate") {
    setDelivery(next);
    try {
      window.sessionStorage.setItem(deliveryStorageKey(ovfId), next);
    } catch {
      /* ignore quota */
    }
  }

  function shipHref(source: OvfChallanShipSource): string {
    return ovfChallanHref(
      ovfId,
      source,
      preview?.purchase_order_id || linkedPos[0]?.id,
      shipKind,
    );
  }

  function openBookDialog(productName: string) {
    setBookProductName(productName);
    setBookOpen(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={preview ? `Item plan · ${preview.ovf_no}` : "Item plan"}
        backHref="/procurement/scm"
        backLabel="SCM Queue"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
            {preview ? (
              <Link
                href={`/procurement/scm/ovf/${ovfId}`}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "cursor-pointer transition-colors duration-200",
                )}
              >
                <ClipboardList className="mr-1.5 size-3.5" />
                View OVF
              </Link>
            ) : null}
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
          Loading item plan…
        </div>
      ) : null}

      {preview ? (
        <>
          <section className="space-y-3 rounded-lg border-2 border-foreground/20 bg-card p-4 shadow-sm">
            <h2 className="text-base font-semibold tracking-tight">Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Product</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-left font-medium">Source</th>
                    <th className="px-3 py-2 text-left font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        No vendor charge lines on this OVF.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line, index) => {
                      const avail = (preview.stock_availability || []).find(
                        (row) => ovfProductKey(row.product_name) === ovfProductKey(line.product_name),
                      );
                      const allocated = Number(avail?.allocated_qty) || 0;
                      const remaining = Number(avail?.remaining_qty) || 0;
                      const canBookInventory =
                        line.source === "inventory" && remaining > 0 && !onHold;
                      const vendorName = (line.distributor_name || "").trim();
                      const poOpen =
                        line.source === "purchase_order" &&
                        vendorName &&
                        openDistributors.some(
                          (name) => name.trim().toLowerCase() === vendorName.toLowerCase(),
                        );
                      return (
                        <tr key={`${line.product_name}-${index}`} className="border-b border-border/70">
                          <td className="px-3 py-2 font-medium">{line.product_name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatPlanQty(line.qty)}</td>
                          <td className="px-3 py-2">
                            {line.source === "inventory" ? "Inventory" : vendorName || "Purchase order"}
                          </td>
                          <td className="px-3 py-2">
                            {line.source === "inventory" ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {allocated > 0 ? (
                                  <span className="text-xs font-medium text-emerald-800">Stock booked</span>
                                ) : null}
                                {canBookInventory ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="cursor-pointer transition-colors duration-200"
                                    onClick={() => openBookDialog(line.product_name)}
                                  >
                                    <Package className="mr-1.5 size-3.5" />
                                    Book from inventory
                                  </Button>
                                ) : null}
                                {allocated <= 0 && !canBookInventory ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : null}
                              </div>
                            ) : poOpen && !onHold ? (
                              <Link
                                href={ovfCreatePoHref(ovfId, vendorName)}
                                className={cn(
                                  buttonVariants({ size: "sm" }),
                                  "cursor-pointer transition-colors duration-200",
                                )}
                              >
                                <ShoppingCart className="mr-1.5 size-3.5" />
                                Create PO
                              </Link>
                            ) : line.source === "purchase_order" &&
                              vendorName &&
                              !openDistributors.some(
                                (name) => name.trim().toLowerCase() === vendorName.toLowerCase(),
                              ) &&
                              canShipPo ? (
                              <span className="text-xs font-medium text-emerald-800">PO created</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {line.action === "no_vendor" ? "Assign vendor in CRM" : "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {showDelivery ? (
          <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold tracking-tight">
              {showTogetherSeparate ? "Deliver booked items" : "Deliver booked stock"}
            </h2>
            {showTogetherSeparate ? (
              <div className="space-y-2">
                {(
                  [
                    {
                      value: "together" as const,
                      title: "Together",
                      detail: "Send all booked items on one billing / delivery challan.",
                    },
                    {
                      value: "separate" as const,
                      title: "Separately",
                      detail: "Ship booked stock now. Vendor PO items can go on a later document.",
                    },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors duration-200",
                      "border-border hover:bg-muted/40 has-[:checked]:border-sky-400 has-[:checked]:bg-sky-50/70",
                    )}
                  >
                    <input
                      type="radio"
                      name="ovf-item-plan-delivery"
                      className="mt-0.5 cursor-pointer accent-sky-700"
                      checked={delivery === option.value}
                      onChange={() => chooseDelivery(option.value)}
                    />
                    <span className="min-w-0 space-y-0.5">
                      <span className="block text-sm font-medium text-foreground">{option.title}</span>
                      <span className="block text-xs text-muted-foreground">{option.detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}

              <p className="text-xs font-medium text-foreground">Document type</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "billing" as const, label: "Billing" },
                    { value: "delivery_challan" as const, label: "Delivery challan" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setShipKind(option.value)}
                    className={cn(
                      "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-200",
                      shipKind === option.value
                        ? "border-sky-400 bg-sky-50 text-sky-900"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {!showTogetherSeparate || delivery === "together" ? (
                  <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer transition-colors duration-200"
                    disabled={!canShipInventory}
                    onClick={() =>
                      router.push(
                        showTogetherSeparate && canShipCombined && delivery === "together"
                          ? shipHref("combined")
                          : shipHref("inventory"),
                      )
                    }
                  >
                    <Truck className="mr-1.5 size-3.5" />
                    {showTogetherSeparate && canShipCombined && delivery === "together"
                      ? "Ship together"
                      : "Deliver booked stock"}
                  </Button>
                ) : null}
                {showTogetherSeparate && delivery === "separate" ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="cursor-pointer transition-colors duration-200"
                      disabled={!canShipInventory}
                      onClick={() => router.push(shipHref("inventory"))}
                    >
                      <Truck className="mr-1.5 size-3.5" />
                      Deliver booked stock
                    </Button>
                    {canShipPo ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="cursor-pointer transition-colors duration-200"
                        onClick={() => router.push(shipHref("po"))}
                      >
                        <Truck className="mr-1.5 size-3.5" />
                        Ship vendor PO
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
          </section>
          ) : null}
        </>
      ) : null}

      <ScmOvfBookFromStockDialog
        open={bookOpen}
        ovfId={ovfId}
        productName={bookProductName}
        onClose={() => {
          setBookOpen(false);
          setBookProductName(null);
        }}
        onBooked={() => {
          void load();
        }}
      />
    </div>
  );
}
