"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Package, RefreshCw, ShoppingCart, Truck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { ScmOvfBookFromStockDialog } from "@/components/procurement/scm-ovf-book-from-stock-dialog";
import { VendorSearchSelect } from "@/components/procurement/vendor-search-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  getScmOvfPreview,
  listVendorOptions,
  updateScmItemPlanVendor,
  type ScmOvfPreview,
  type VendorOption,
} from "@/services/procurement-service";
import {
  ovfChallanHref,
  ovfCreatePoRemainderHref,
  isInStockDistributor,
  IN_STOCK_DISTRIBUTOR_LABEL,
  ovfDistributorKey,
  ovfProductKey,
  resolvePoForDistributor,
  setOvfPoRemainderProducts,
  type OvfChallanShipSource,
  type OvfShipDocumentKind,
} from "@/utils/ovf-stock";
import { matchVendorByDistributor } from "@/utils/vendor-oem-match";

function lineDistributorKey(productName: string, index: number): string {
  return `${ovfProductKey(productName)}:${index}`;
}

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
  const [createPoPending, startCreatePoNav] = useTransition();
  const [preview, setPreview] = useState<ScmOvfPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorSaveError, setVendorSaveError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<"together" | "separate">("together");
  const [shipKind, setShipKind] = useState<OvfShipDocumentKind>("delivery_challan");
  const [bookProductName, setBookProductName] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  /** Per-line distributor override keyed by product+index (defaults to fetched CRM name). */
  const [distributorByLine, setDistributorByLine] = useState<Record<string, string>>({});
  const [savingLineKey, setSavingLineKey] = useState<string | null>(null);
  const saveSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void listVendorOptions()
      .then((rows) => {
        if (!cancelled) setVendors(rows);
      })
      .catch(() => {
        if (!cancelled) setVendors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const seedDistributorSelections = useCallback(
    (ovf: ScmOvfPreview, vendorRows: VendorOption[]) => {
      const next: Record<string, string> = {};
      const planLines = ovf.item_plan?.lines || [];
      planLines.forEach((line, index) => {
        const key = lineDistributorKey(line.product_name, index);
        const fetched = (line.distributor_name || "").trim();
        if (line.source === "inventory" || isInStockDistributor(fetched)) {
          next[key] = IN_STOCK_DISTRIBUTOR_LABEL;
          return;
        }
        const matched = matchVendorByDistributor(vendorRows, fetched);
        next[key] = matched?.label || fetched;
      });
      setDistributorByLine(next);
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovf, vendorRows] = await Promise.all([
        getScmOvfPreview(ovfId),
        listVendorOptions().catch(() => [] as VendorOption[]),
      ]);
      setPreview(ovf);
      setVendors(vendorRows);
      seedDistributorSelections(ovf, vendorRows);
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
  }, [ovfId, seedDistributorSelections]);

  useEffect(() => {
    void load();
  }, [load]);

  const lines = preview?.item_plan?.lines || [];
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

  /** Selected distributor for a plan line (dropdown override or CRM default). */
  function lineVendorName(
    line: { product_name: string; distributor_name?: string | null },
    index: number,
  ): string {
    const key = lineDistributorKey(line.product_name, index);
    return (distributorByLine[key] || line.distributor_name || "").trim();
  }

  async function persistDistributor(
    line: { product_name: string },
    index: number,
    label: string,
  ) {
    const lineKey = lineDistributorKey(line.product_name, index);
    const distributorName = isInStockDistributor(label)
      ? IN_STOCK_DISTRIBUTOR_LABEL
      : label.trim();
    if (!distributorName) return;

    setDistributorByLine((current) => ({
      ...current,
      [lineKey]: distributorName,
    }));
    setVendorSaveError(null);
    setSavingLineKey(lineKey);
    const seq = ++saveSeqRef.current;
    try {
      const updated = await updateScmItemPlanVendor(ovfId, {
        product_name: line.product_name,
        line_index: index,
        distributor_name: distributorName,
      });
      if (seq !== saveSeqRef.current) return;
      setPreview(updated);
      seedDistributorSelections(updated, vendors);
    } catch (err) {
      if (seq !== saveSeqRef.current) return;
      setVendorSaveError(formatApiError(err, "Failed to save vendor selection"));
      void load();
    } finally {
      if (seq === saveSeqRef.current) setSavingLineKey(null);
    }
  }

  /**
   * All products on this OVF that share the same selected distributor and still need a PO.
   * Create PO opens one combined draft for the whole group — not a single line.
   */
  function productsNeedingPoForDistributor(distributorName: string): string[] {
    const needle = ovfDistributorKey(distributorName);
    if (!needle || isInStockDistributor(distributorName) || !preview) return [];
    if (resolvePoForDistributor(preview, distributorName)) return [];

    const names: string[] = [];
    const seen = new Set<string>();
    lines.forEach((line, index) => {
      const vendorName = lineVendorName(line, index);
      if (ovfDistributorKey(vendorName) !== needle) return;
      if (isInStockDistributor(vendorName)) return;

      const needsPo =
        line.source === "purchase_order" ||
        (line.source === "inventory" &&
          (line.action === "stock_short" || Number(line.po_qty) > 0));
      if (!needsPo) return;

      const productKey = ovfProductKey(line.product_name);
      if (!productKey || seen.has(productKey)) return;
      seen.add(productKey);
      names.push(line.product_name);
    });
    return names;
  }

  function openCreatePoForDistributor(distributorName: string) {
    const vendor = distributorName.trim();
    if (!vendor || isInStockDistributor(vendor)) return;
    const products = productsNeedingPoForDistributor(vendor);
    if (products.length === 0) return;
    setOvfPoRemainderProducts(ovfId, products);
    startCreatePoNav(() => {
      router.push(ovfCreatePoRemainderHref(ovfId, vendor));
    });
  }

  /** Products whose distributor is currently IN STOCK (eligible for book-from-inventory). */
  const inStockBookProductNames = lines
    .map((line, index) => {
      const vendorName = lineVendorName(line, index);
      if (!isInStockDistributor(vendorName)) return null;
      const avail = (preview?.stock_availability || []).find(
        (row) => ovfProductKey(row.product_name) === ovfProductKey(line.product_name),
      );
      const remaining = Number(avail?.remaining_qty) || 0;
      if (remaining <= 0) return null;
      return line.product_name;
    })
    .filter((name): name is string => Boolean(name));

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
      {vendorSaveError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {vendorSaveError}
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
                    <th className="px-3 py-2 text-left font-medium">Distributor name</th>
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
                      const fetchedVendorName = (line.distributor_name || "").trim();
                      const lineKey = lineDistributorKey(line.product_name, index);
                      const vendorName =
                        (distributorByLine[lineKey] || fetchedVendorName).trim();
                      const canBookInventory =
                        isInStockDistributor(vendorName) && remaining > 0 && !onHold;
                      const canCreatePoForShortfall =
                        line.source === "inventory" &&
                        line.action === "stock_short" &&
                        Number(line.po_qty) > 0 &&
                        !onHold &&
                        !isInStockDistributor(vendorName);
                      const linkedPo =
                        line.source === "purchase_order" && vendorName && preview
                          ? resolvePoForDistributor(preview, vendorName) ||
                            (fetchedVendorName
                              ? resolvePoForDistributor(preview, fetchedVendorName)
                              : null)
                          : null;
                      const canCreatePo =
                        line.source === "purchase_order" &&
                        Boolean(vendorName) &&
                        !isInStockDistributor(vendorName) &&
                        !linkedPo &&
                        !onHold;
                      const canChangeDistributor = !linkedPo && !onHold;
                      const selectedVendorForPo =
                        vendorName && !isInStockDistributor(vendorName) ? vendorName : "";
                      return (
                        <tr key={`${line.product_name}-${index}`} className="border-b border-border/70">
                          <td className="px-3 py-2 font-medium">{line.product_name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatPlanQty(line.qty)}</td>
                          <td className="px-3 py-2">
                            <VendorSearchSelect
                              value={vendorName}
                              vendors={vendors}
                              includeInStock
                              disabled={!canChangeDistributor || savingLineKey === lineKey}
                              placeholder="Select vendor…"
                              onChange={(label) => {
                                void persistDistributor(line, index, label);
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {allocated > 0 && isInStockDistributor(vendorName) ? (
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
                              {linkedPo ? (
                                <Link
                                  href={`/procurement/orders/${linkedPo.id}`}
                                  className={cn(
                                    buttonVariants({ size: "sm", variant: "outline" }),
                                    "h-auto w-fit cursor-pointer px-2 py-1 text-xs transition-colors duration-200",
                                  )}
                                >
                                  {linkedPo.label}
                                </Link>
                              ) : canCreatePo ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="cursor-pointer transition-colors duration-200"
                                  disabled={createPoPending}
                                  onClick={() =>
                                    openCreatePoForDistributor(selectedVendorForPo || vendorName)
                                  }
                                >
                                  <ShoppingCart className="mr-1.5 size-3.5" />
                                  {createPoPending ? "Opening…" : "Create PO"}
                                </Button>
                              ) : canCreatePoForShortfall ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="cursor-pointer transition-colors duration-200"
                                  disabled={createPoPending || !selectedVendorForPo}
                                  title={
                                    selectedVendorForPo
                                      ? undefined
                                      : "Select a vendor before creating a PO"
                                  }
                                  onClick={() => openCreatePoForDistributor(selectedVendorForPo)}
                                >
                                  <ShoppingCart className="mr-1.5 size-3.5" />
                                  {createPoPending ? "Opening…" : "Create PO"}
                                </Button>
                              ) : onHold && line.source === "purchase_order" ? (
                                <span className="text-xs text-muted-foreground">On hold</span>
                              ) : !canBookInventory &&
                                !linkedPo &&
                                !canCreatePo &&
                                !canCreatePoForShortfall &&
                                !(allocated > 0 && isInStockDistributor(vendorName)) ? (
                                <span className="text-xs text-muted-foreground">
                                  {line.action === "no_vendor" && !selectedVendorForPo
                                    ? "Select vendor"
                                    : "—"}
                                </span>
                              ) : null}
                            </div>
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
        allowedProductNames={inStockBookProductNames}
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
