"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Package, RefreshCw, ShoppingCart, Truck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { ScmOvfBookFromStockDialog } from "@/components/procurement/scm-ovf-book-from-stock-dialog";
import { VendorSearchSelect } from "@/components/procurement/vendor-search-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  getPurchaseOrder,
  getScmOvfPreview,
  listVendorOptions,
  updateScmItemPlanVendor,
  type ScmItemPlanLine,
  type ScmOvfPreview,
  type VendorOption,
} from "@/services/procurement-service";
import {
  assignUniquePosToItemPlanRows,
  clearOvfItemPlanSplits,
  itemPlanRowOffersCreatePo,
  IN_STOCK_DISTRIBUTOR_LABEL,
  isInStockDistributor,
  loadOvfItemPlanSplits,
  ovfChallanHref,
  ovfCreatePoRemainderHref,
  ovfProductKey,
  saveOvfItemPlanSplits,
  ovfDistributorKey,
  setOvfPendingItemPlanPoRows,
  setOvfPoLineQtyOverrides,
  setOvfPoRemainderProducts,
  type OvfChallanShipSource,
  type OvfItemPlanSplitRow,
  type OvfShipDocumentKind,
} from "@/utils/ovf-stock";
import {
  matchVendorByDistributor,
  vendorSupplyStates,
} from "@/utils/vendor-oem-match";
import { downloadOrderPdf } from "@/utils/purchase-order-pdf";

function formatPlanQty(value: number | null | undefined): string {
  const n = Number(value) || 0;
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function deliveryStorageKey(ovfId: string): string {
  return `ovf-item-plan-delivery:${ovfId}`;
}

function resolveDistributorLabel(
  line: ScmItemPlanLine,
  vendors: VendorOption[],
): string {
  const fetched = (line.distributor_name || "").trim();
  if (line.source === "inventory" || isInStockDistributor(fetched)) {
    return IN_STOCK_DISTRIBUTOR_LABEL;
  }
  const matched = matchVendorByDistributor(vendors, fetched);
  return matched?.label || fetched;
}

function newRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function planQtyForLine(line: ScmItemPlanLine): number {
  if (line.source === "purchase_order") return Number(line.qty) || 0;
  return Math.max(0, Number(line.po_qty ?? line.qty) || 0);
}

function defaultStateForDistributor(
  distributorName: string,
  vendors: VendorOption[],
): string {
  if (!distributorName || isInStockDistributor(distributorName)) return "";
  const vendor = matchVendorByDistributor(vendors, distributorName);
  return vendorSupplyStates(vendor)[0] || "";
}

function rowsFromApiLines(
  lines: ScmItemPlanLine[],
  vendors: VendorOption[],
): OvfItemPlanSplitRow[] {
  return lines.map((line, index) => {
    const qty = planQtyForLine(line);
    const distributorName = resolveDistributorLabel(line, vendors);
    return {
      id: newRowId(),
      product_name: line.product_name,
      distributor_name: distributorName,
      distributor_state: defaultStateForDistributor(distributorName, vendors) || null,
      source: line.source,
      action: line.action,
      api_line_index: index,
      qty,
      create_qty: qty > 0 ? qty : 0,
      po_qty: Number(line.po_qty) || 0,
      book_qty: Number(line.book_qty) || 0,
      on_hand_qty: Number(line.on_hand_qty) || 0,
      allocated_qty: Number(line.allocated_qty) || 0,
      in_stock: Boolean(line.in_stock),
      po_started: false,
    };
  });
}

function normalizeSavedRows(
  rows: OvfItemPlanSplitRow[],
  vendors: VendorOption[] = [],
): OvfItemPlanSplitRow[] {
  return rows.map((row, index) => {
    const linkedPoId = (row.linked_po_id || "").trim() || null;
    const linkedPoLabel = (row.linked_po_label || "").trim() || null;
    // Only lock a row after a real PO was created. Opening Create PO alone must not stick.
    const poStarted = Boolean(linkedPoId);
    const distributorName = (row.distributor_name || "").trim();
    const savedState = (row.distributor_state || "").trim();
    const states = vendorSupplyStates(matchVendorByDistributor(vendors, distributorName));
    const distributorState =
      savedState && states.some((state) => state.toLowerCase() === savedState.toLowerCase())
        ? savedState
        : states[0] || savedState || null;
    return {
      ...row,
      distributor_state: distributorState,
      api_line_index:
        typeof row.api_line_index === "number" && Number.isFinite(row.api_line_index)
          ? row.api_line_index
          : index,
      linked_po_id: linkedPoId,
      linked_po_label: linkedPoLabel,
      po_started: poStarted,
    };
  });
}

function rowHasCreatedPo(row: OvfItemPlanSplitRow): boolean {
  return Boolean((row.linked_po_id || "").trim());
}

/** Cap at max; empty/invalid/≤0 stays 0 so the qty field can be cleared while typing. */
function clampCreateQty(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(max, value);
}

function parseCreateQtyRaw(raw: string, max: number): number {
  const cleaned = raw.trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return clampCreateQty(parsed, max);
}

export function ScmOvfItemPlanPage({ ovfId }: { ovfId: string }) {
  const router = useRouter();
  const [createPoPending, startCreatePoNav] = useTransition();
  const [preview, setPreview] = useState<ScmOvfPreview | null>(null);
  const [planRows, setPlanRows] = useState<OvfItemPlanSplitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorSaveError, setVendorSaveError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<"together" | "separate">("together");
  const [shipKind, setShipKind] = useState<OvfShipDocumentKind>("delivery_challan");
  const [bookProductName, setBookProductName] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  /** Raw qty text while editing so empty / partial values are not forced back to 1. */
  const [qtyDraftByRowId, setQtyDraftByRowId] = useState<Record<string, string>>({});
  const saveSeqRef = useRef(0);

  const persistRows = useCallback(
    (rows: OvfItemPlanSplitRow[]) => {
      setPlanRows(rows);
      saveOvfItemPlanSplits(ovfId, rows);
    },
    [ovfId],
  );

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setVendorSaveError(null);
    try {
      const [ovf, vendorRows] = await Promise.all([
        getScmOvfPreview(ovfId),
        listVendorOptions().catch(() => [] as VendorOption[]),
      ]);
      setPreview(ovf);
      setVendors(vendorRows);
      const apiLines = ovf.item_plan?.lines || [];
      const saved = loadOvfItemPlanSplits(ovfId);
      const baseRows =
        saved && saved.length > 0
          ? normalizeSavedRows(saved, vendorRows)
          : rowsFromApiLines(apiLines, vendorRows);
      const normalized = assignUniquePosToItemPlanRows(
        baseRows,
        ovf.purchase_orders,
        ovf.po_groups,
      );
      setPlanRows(normalized);
      saveOvfItemPlanSplits(ovfId, normalized);
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

  function updateCreateQty(rowId: string, raw: string) {
    const cleaned = raw.replace(/[^\d.]/g, "");
    setQtyDraftByRowId((prev) => ({ ...prev, [rowId]: cleaned }));
    persistRows(
      planRows.map((row) => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          create_qty: parseCreateQtyRaw(cleaned, row.qty),
        };
      }),
    );
  }

  function commitCreateQty(rowId: string) {
    setQtyDraftByRowId((prev) => {
      if (!(rowId in prev)) return prev;
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }

  function persistDistributorState(row: OvfItemPlanSplitRow, state: string) {
    const nextState = state.trim();
    persistRows(
      planRows.map((current) =>
        current.id === row.id
          ? { ...current, distributor_state: nextState || null }
          : current,
      ),
    );
  }

  async function persistDistributor(row: OvfItemPlanSplitRow, label: string) {
    const distributorName = isInStockDistributor(label)
      ? IN_STOCK_DISTRIBUTOR_LABEL
      : label.trim();
    if (!distributorName) return;

    const nextState = defaultStateForDistributor(distributorName, vendors) || null;
    const nextRows = planRows.map((current) =>
      current.id === row.id
        ? {
          ...current,
          distributor_name: distributorName,
          distributor_state: nextState,
        }
        : current,
    );
    persistRows(nextRows);
    setVendorSaveError(null);
    setSavingRowId(row.id);
    const seq = ++saveSeqRef.current;
    try {
      const updated = await updateScmItemPlanVendor(ovfId, {
        product_name: row.product_name,
        line_index: row.api_line_index,
        distributor_name: distributorName,
      });
      if (seq !== saveSeqRef.current) return;
      setPreview(updated);
    } catch (err) {
      if (seq !== saveSeqRef.current) return;
      setVendorSaveError(formatApiError(err, "Failed to save vendor selection"));
      void load();
    } finally {
      if (seq === saveSeqRef.current) setSavingRowId(null);
    }
  }

  function openCreatePoForRow(row: OvfItemPlanSplitRow) {
    const vendor = row.distributor_name.trim();
    if (!vendor || isInStockDistributor(vendor)) return;
    if (rowHasCreatedPo(row)) return;

    const groupKey = (current: OvfItemPlanSplitRow) =>
      `${ovfDistributorKey(current.distributor_name)}|${(current.distributor_state || "").trim().toLowerCase()}`;
    const group = planRows.filter(
      (current) =>
        groupKey(current) === groupKey(row) &&
        !isInStockDistributor(current.distributor_name) &&
        !rowHasCreatedPo(current),
    );
    if (group.length === 0) return;

    const groupIds = new Set(group.map((current) => current.id));
    const nextRows: OvfItemPlanSplitRow[] = [];
    const qtyByProduct: Record<string, number> = {};
    const productNames: string[] = [];
    const pendingIds: string[] = [];

    for (const current of planRows) {
      if (!groupIds.has(current.id)) {
        nextRows.push(current);
        continue;
      }
      const createQty = clampCreateQty(current.create_qty, current.qty);
      if (createQty <= 0) continue;
      const remainderQty = Math.max(0, Number((current.qty - createQty).toFixed(4)));
      nextRows.push({
        ...current,
        qty: createQty,
        create_qty: createQty,
        po_started: false,
        linked_po_id: current.linked_po_id ?? null,
        linked_po_label: current.linked_po_label ?? null,
      });
      pendingIds.push(current.id);
      productNames.push(current.product_name);
      const productKey = ovfProductKey(current.product_name) || current.product_name;
      qtyByProduct[productKey] = Number(
        ((qtyByProduct[productKey] || 0) + createQty).toFixed(4),
      );
      if (remainderQty > 0) {
        nextRows.push({
          ...current,
          id: newRowId(),
          qty: remainderQty,
          create_qty: remainderQty,
          po_started: false,
          linked_po_id: null,
          linked_po_label: null,
        });
      }
    }

    if (pendingIds.length === 0) return;

    persistRows(nextRows);
    setOvfPendingItemPlanPoRows(ovfId, pendingIds);
    setOvfPoRemainderProducts(ovfId, productNames);
    setOvfPoLineQtyOverrides(ovfId, qtyByProduct);
    const distributorState = (row.distributor_state || "").trim() || null;
    startCreatePoNav(() => {
      router.push(ovfCreatePoRemainderHref(ovfId, vendor, distributorState));
    });
  }

  const inStockBookProductNames = planRows
    .map((row) => {
      if (!isInStockDistributor(row.distributor_name)) return null;
      const avail = (preview?.stock_availability || []).find(
        (item) => ovfProductKey(item.product_name) === ovfProductKey(row.product_name),
      );
      const remaining = Number(avail?.remaining_qty) || 0;
      if (remaining <= 0) return null;
      return row.product_name;
    })
    .filter((name): name is string => Boolean(name));

  return (
    <div className="space-y-4">
      <PageHeader
        title={preview ? `Item plan · ${preview.ovf_no}` : "Item plan"}
        backHref={`/procurement/scm/ovf/${ovfId}`}
        backText="View OVF"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading}
              onClick={() => {
                clearOvfItemPlanSplits(ovfId);
                void load();
              }}
            >
              <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
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
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight">Items</h2>
              <p className="text-xs text-muted-foreground">
                Set Qty to the amount for the next PO. Any remainder stays as a new row below so you
                can create another PO later.
              </p>
            </div>
            {(preview.purchase_orders || []).some(
              (po) => (po.fulfillment_stage || "").toLowerCase() === "vendor_rejected",
            ) ? (
              <div className="space-y-2">
                {(preview.purchase_orders || [])
                  .filter((po) => (po.fulfillment_stage || "").toLowerCase() === "vendor_rejected")
                  .map((po) => {
                    const label =
                      (po.company_po_number || po.document_number || "PO").trim() || "PO";
                    return (
                      <div
                        key={po.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2"
                      >
                        <p className="text-xs text-red-950">
                          <span className="font-semibold">{label} was rejected.</span> That purchase
                          order is stopped. Create a new PO for the open quantity. The old PO PDF is
                          still available.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pdfBusyId === po.id}
                          className="h-8 cursor-pointer border-red-200 bg-white text-red-900 transition-colors duration-200 hover:bg-red-50"
                          onClick={() => {
                            void (async () => {
                              setPdfBusyId(po.id);
                              setError(null);
                              try {
                                const order = await getPurchaseOrder(po.id);
                                await downloadOrderPdf(
                                  order,
                                  {
                                    name: (po.vendor_name || "").trim() || "Vendor",
                                    gstin: (() => {
                                      const match = vendors.find(
                                        (v) => String(v.id) === String(po.vendor_id || ""),
                                      );
                                      return (
                                        match?.addressEntries?.[0]?.gstNumber?.trim() ||
                                        match?.taxNumber?.trim() ||
                                        ""
                                      );
                                    })(),
                                  },
                                  undefined,
                                  { watermark: false },
                                );
                              } catch (err) {
                                setError(
                                  err instanceof Error && err.message.trim()
                                    ? err.message
                                    : "Failed to open the rejected PO PDF",
                                );
                              } finally {
                                setPdfBusyId(null);
                              }
                            })();
                          }}
                        >
                          <FileText className="mr-1.5 size-3.5" aria-hidden />
                          {pdfBusyId === po.id ? "Opening…" : "Old PO PDF"}
                        </Button>
                      </div>
                    );
                  })}
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Product</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-left font-medium">Distributor name</th>
                    <th className="px-3 py-2 text-left font-medium">Distributor state</th>
                    <th className="px-3 py-2 text-left font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {planRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        No vendor charge lines on this OVF.
                      </td>
                    </tr>
                  ) : (
                    planRows.map((row) => {
                      const avail = (preview.stock_availability || []).find(
                        (item) =>
                          ovfProductKey(item.product_name) === ovfProductKey(row.product_name),
                      );
                      const allocated = Number(avail?.allocated_qty) || 0;
                      const remaining = Number(avail?.remaining_qty) || 0;
                      const vendorName = row.distributor_name;
                      const matchedVendor = isInStockDistributor(vendorName)
                        ? null
                        : matchVendorByDistributor(vendors, vendorName);
                      const stateOptions = vendorSupplyStates(matchedVendor);
                      const selectedState = (row.distributor_state || "").trim();
                      const canBookInventory =
                        isInStockDistributor(vendorName) && remaining > 0 && !onHold;
                      const poEligible =
                        row.qty > 0 &&
                        !onHold &&
                        (row.source === "purchase_order" ||
                          (row.source === "inventory" &&
                            (row.action === "stock_short" || row.po_qty > 0)));
                      const hasCreatedPo = rowHasCreatedPo(row);
                      const linkedPo = hasCreatedPo
                        ? {
                          id: String(row.linked_po_id),
                          label:
                            (row.linked_po_label || "").trim() ||
                            String(row.linked_po_id),
                          status: null as string | null,
                        }
                        : null;
                      // Linked rows never offer Create PO again; remainder rows stay eligible.
                      const canCreatePo = itemPlanRowOffersCreatePo(row, onHold);
                      const qtyEditable =
                        poEligible &&
                        !hasCreatedPo &&
                        !isInStockDistributor(vendorName);
                      const canChangeDistributor = !hasCreatedPo && !onHold;
                      const canChangeState =
                        canChangeDistributor &&
                        Boolean(matchedVendor) &&
                        stateOptions.length > 0;
                      return (
                        <tr key={row.id} className="border-b border-border/70">
                          <td className="px-3 py-2 font-medium">
                            <span className="inline-flex flex-col gap-0.5">
                              <span>{row.product_name}</span>
                              {hasCreatedPo ? (
                                <span className="text-[11px] font-medium text-sky-800">
                                  PO qty locked
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {qtyEditable ? (
                              <div className="inline-flex flex-col items-end gap-0.5">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={
                                    row.id in qtyDraftByRowId
                                      ? qtyDraftByRowId[row.id]
                                      : row.create_qty > 0
                                        ? String(row.create_qty)
                                        : ""
                                  }
                                  placeholder="0"
                                  aria-label={`PO quantity for ${row.product_name}`}
                                  className="h-8 w-[5.5rem] cursor-text text-right tabular-nums transition-colors duration-200"
                                  onChange={(event) => {
                                    updateCreateQty(row.id, event.target.value);
                                  }}
                                  onBlur={() => commitCreateQty(row.id)}
                                />
                                {row.create_qty > 0 && row.create_qty < row.qty ? (
                                  <span className="text-[11px] text-muted-foreground">
                                    of {formatPlanQty(row.qty)} · remainder{" "}
                                    {formatPlanQty(row.qty - row.create_qty)}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">
                                    available {formatPlanQty(row.qty)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              formatPlanQty(row.qty)
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <VendorSearchSelect
                              value={vendorName}
                              vendors={vendors}
                              includeInStock
                              disabled={!canChangeDistributor || savingRowId === row.id}
                              placeholder="Select vendor…"
                              onChange={(label) => {
                                void persistDistributor(row, label);
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            {isInStockDistributor(vendorName) ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <select
                                value={selectedState}
                                disabled={!canChangeState || savingRowId === row.id}
                                aria-label={`Distributor state for ${row.product_name}`}
                                className="h-8 w-full min-w-[8.5rem] max-w-[12rem] cursor-pointer rounded-md border border-input bg-background px-2 text-xs outline-none transition-colors duration-200 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
                                onChange={(event) => {
                                  persistDistributorState(row, event.target.value);
                                }}
                              >
                                <option value="">
                                  {matchedVendor
                                    ? stateOptions.length > 0
                                      ? "Select state…"
                                      : "No state on vendor"
                                    : "Select vendor first"}
                                </option>
                                {stateOptions.map((state) => (
                                  <option key={state} value={state}>
                                    {state}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {allocated > 0 && isInStockDistributor(vendorName) ? (
                                <span className="text-xs font-medium text-emerald-800">
                                  Stock booked
                                </span>
                              ) : null}
                              {canBookInventory ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="cursor-pointer transition-colors duration-200"
                                  onClick={() => openBookDialog(row.product_name)}
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
                              ) : null}
                              {canCreatePo ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="cursor-pointer transition-colors duration-200"
                                  disabled={createPoPending || row.create_qty <= 0}
                                  title={
                                    vendorName ? undefined : "Select a vendor before creating a PO"
                                  }
                                  onClick={() => openCreatePoForRow(row)}
                                >
                                  <ShoppingCart className="mr-1.5 size-3.5" />
                                  {createPoPending
                                    ? "Opening…"
                                    : row.create_qty < row.qty
                                      ? `Create PO (${formatPlanQty(row.create_qty)})`
                                      : "Create PO"}
                                </Button>
                              ) : onHold && (row.source === "purchase_order" || row.po_qty > 0) ? (
                                <span className="text-xs text-muted-foreground">On hold</span>
                              ) : !canBookInventory &&
                                !linkedPo &&
                                !canCreatePo &&
                                !(allocated > 0 && isInStockDistributor(vendorName)) ? (
                                <span className="text-xs text-muted-foreground">
                                  {!vendorName ? "Select vendor" : "-"}
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
                        detail:
                          "Ship booked stock now. Vendor PO items can go on a later document.",
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
                        <span className="block text-sm font-medium text-foreground">
                          {option.title}
                        </span>
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
