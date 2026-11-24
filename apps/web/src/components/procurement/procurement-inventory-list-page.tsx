"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, IndianRupee, Package, Plus, RefreshCw, Truck, Upload } from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { ProcurementInventoryCharts } from "@/components/procurement/procurement-inventory-charts";
import { ProcurementInventoryAddStockDialog } from "@/components/procurement/procurement-inventory-add-stock-dialog";
import {
  ProcurementInventoryImportDialog,
  INVENTORY_WITHOUT_PO,
  type InventoryImportDraftRow,
} from "@/components/procurement/procurement-inventory-import-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { ListSearch } from "@/components/shared/list-toolbar";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  formatInr,
  importProcurementInventory,
  invalidateProcurementListCache,
  listProcurementInventory,
  listPurchaseOrders,
  listVendorOptions,
  peekProcurementInventoryFromCache,
  type ProcOrder,
  type ProcurementInventoryRow,
  type VendorOption,
} from "@/services/procurement-service";
import {
  buildProcurementInventoryStockSummary,
  formatInventoryDateAdded,
  formatInventoryWarrantyLabel,
  groupGrnStockByProduct,
  isInventoryLedgerRow,
} from "@/utils/procurement-inventory-report";
import { InventoryProductDetailDialog } from "@/components/procurement/inventory-product-detail-dialog";
import { textTokenMatch } from "@/utils/procurement-search";

export function ProcurementInventoryListPage() {
  const router = useRouter();
  const cachedOnMount = peekProcurementInventoryFromCache();
  const [rows, setRows] = useState<ProcurementInventoryRow[]>(() => cachedOnMount ?? []);
  const [vendors, setVendors] = useState<Record<string, VendorOption>>({});
  const [vendorList, setVendorList] = useState<VendorOption[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(() => cachedOnMount === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<ProcOrder[]>([]);
  const [detailProductKey, setDetailProductKey] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (force) invalidateProcurementListCache();
    const hadInstantData = peekProcurementInventoryFromCache() !== null;
    if (!hadInstantData) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const inventory = await listProcurementInventory();
      setRows(inventory);
    } catch (err) {
      if (!hadInstantData) {
        setRows([]);
      }
      setError(formatApiError(err, "Failed to load procurement inventory"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    void listVendorOptions()
      .then((vendorRows) => {
        setVendorList(vendorRows);
        setVendors(Object.fromEntries(vendorRows.map((v) => [v.id, v])));
      })
      .catch(() => {
        setVendorList([]);
      });

    void listPurchaseOrders()
      .then((orders) => setPurchaseOrders(orders))
      .catch(() => setPurchaseOrders([]));
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return rows;
    return rows.filter((row) => {
      const product = row.product_name ?? "";
      const description = row.description ?? "";
      return tokens.every(
        (token) => textTokenMatch(product, token) || textTokenMatch(description, token),
      );
    });
  }, [rows, query]);

  const reportSource = query.trim() ? filtered : rows;
  const grnStockRows = useMemo(
    () => reportSource.filter(isInventoryLedgerRow),
    [reportSource],
  );
  const grnStockByProduct = useMemo(
    () => groupGrnStockByProduct(grnStockRows),
    [grnStockRows],
  );
  const detailProduct = useMemo(
    () => grnStockByProduct.find((row) => row.productKey === detailProductKey) ?? null,
    [grnStockByProduct, detailProductKey],
  );
  const stockSummary = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const [id, vendor] of Object.entries(vendors)) {
      labels[id] = vendor.label;
    }
    return buildProcurementInventoryStockSummary(grnStockRows, { vendorLabels: labels });
  }, [grnStockRows, vendors]);

  async function onConfirmImport(draft: InventoryImportDraftRow[]) {
    setImportBusy(true);
    setImportError(null);
    try {
      await importProcurementInventory(
        draft.map((row) => ({
          product_name: row.product,
          serial_number: row.serial,
          order_id: row.orderId === INVENTORY_WITHOUT_PO ? null : row.orderId,
        })),
      );
      setImportOpen(false);
      await load(true);
    } catch (err) {
      setImportError(formatApiError(err, "Failed to save imported inventory"));
    } finally {
      setImportBusy(false);
    }
  }

  async function onConfirmAddStock(
    lines: Array<{
      product_name: string;
      description: string | null;
      serial_number: string;
      order_id: string | null;
      warranty_valid_till: string | null;
    }>,
  ) {
    setAddBusy(true);
    setAddError(null);
    try {
      await importProcurementInventory(lines);
      setAddOpen(false);
      await load(true);
    } catch (err) {
      setAddError(formatApiError(err, "Failed to add stock"));
    } finally {
      setAddBusy(false);
    }
  }

  return (
    <div className={procurementUi.page}>
      <PageHeader
        title="Inventory"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading}
              onClick={() => {
                setAddError(null);
                setAddOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-3.5" />
              Add stock
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading}
              onClick={() => {
                setImportError(null);
                setImportOpen(true);
              }}
            >
              <Upload className="mr-1.5 size-3.5" />
              Import Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading}
              onClick={() => router.push("/procurement/delivery-challan/new?from=inventory")}
            >
              <Truck className="mr-1.5 size-3.5" />
              Delivery challan
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading || refreshing}
              onClick={() => void load(true)}
            >
              <RefreshCw
                className={cn("mr-1.5 size-3.5", (loading || refreshing) && "animate-spin")}
              />
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

      {detailError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {detailError}
        </div>
      ) : null}

      <div className="flex justify-end">
        <ListSearch
          value={query}
          onChange={setQuery}
          placeholder="Search by product…"
          aria-label="Search inventory by product"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-[118px] animate-pulse rounded-md border border-border/60 bg-muted/20" />
            <div className="h-[118px] animate-pulse rounded-md border border-border/60 bg-muted/20" />
            <div className="h-[118px] animate-pulse rounded-md border border-border/60 bg-muted/20" />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="h-[240px] animate-pulse rounded-md border border-border/60 bg-muted/20" />
            <div className="h-[240px] animate-pulse rounded-md border border-border/60 bg-muted/20" />
          </div>
          <div className="h-32 animate-pulse rounded-md border border-border/60 bg-muted/20" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <FinanceKpiCard
              label="Units in stock"
              value={String(stockSummary.totalUnits)}
              icon={Boxes}
            />
            <FinanceKpiCard
              label="OEM name"
              value={String(stockSummary.productCount)}
              icon={Package}
            />
            <FinanceKpiCard
              label="Stock value"
              value={formatInr(stockSummary.totalStockValue)}
              icon={IndianRupee}
          />
          </div>

          <ProcurementInventoryCharts summary={stockSummary} />

          <div className={procurementUi.sectionCard}>
            <p className={procurementUi.sectionTitle}>Stock by product</p>
            {grnStockRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No stock on hand. Add stock manually, import Excel, or receive on a GRN without
                billing the full vendor-invoice quantity.
              </p>
            ) : (
              <div className={procurementUi.tableShell}>
                <div className={procurementUi.tableScroll}>
                  <table
                    className={cn(
                      procurementUi.table,
                      "w-full min-w-[960px] table-fixed border-separate border-spacing-0",
                    )}
                  >
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[7%]" />
                      <col className="w-[16%]" />
                      <col className="w-[9%]" />
                      <col className="w-[14%]" />
                      <col className="w-[12%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead className={procurementUi.thead}>
                      <tr>
                        <th className={cn(procurementUi.th, "px-3")}>Product</th>
                        <th className={cn(procurementUi.th, "px-3 text-right")}>Qty</th>
                        <th className={cn(procurementUi.th, "px-3")}>Description</th>
                        <th className={cn(procurementUi.th, "px-3 text-right")}>Price</th>
                        <th className={cn(procurementUi.th, "px-3")}>Serial</th>
                        <th className={cn(procurementUi.th, "px-3")}>GRN</th>
                        <th className={cn(procurementUi.th, "px-3")}>Date added</th>
                        <th className={cn(procurementUi.th, "px-3")}>Warranty until</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grnStockByProduct.map((line) => (
                        <tr
                          key={line.productKey}
                          className={cn(
                            procurementUi.tr,
                            line.warrantyExpired &&
                            "bg-destructive/5 hover:bg-destructive/10",
                          )}
                        >
                          <td className={cn(procurementUi.td, "px-3")}>
                            <button
                              type="button"
                              className={cn(
                                "cursor-pointer text-left font-medium transition-colors duration-200 hover:underline",
                                line.warrantyExpired
                                  ? "text-destructive hover:text-destructive"
                                  : "text-foreground hover:text-[#0369A1]",
                              )}
                              onClick={() => {
                                setDetailError(null);
                                setDetailProductKey(line.productKey);
                              }}
                            >
                              {line.productName}
                            </button>
                            {line.warrantyExpired ? (
                              <span className="mt-1 inline-flex rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                                Out of warranty
                              </span>
                            ) : null}
                          </td>
                          <td
                            className={cn(
                              procurementUi.tdNumeric,
                              "px-3 text-right font-mono tabular-nums",
                              line.stockQty < 0 ? "text-destructive" : "text-foreground",
                            )}
                          >
                            {line.stockQty.toLocaleString("en-IN")}
                          </td>
                          <td
                            className={cn(
                              procurementUi.td,
                              "px-3 text-muted-foreground",
                            )}
                          >
                            <span className="line-clamp-2" title={line.description}>
                              {line.description}
                            </span>
                          </td>
                          <td
                            className={cn(
                              procurementUi.tdNumeric,
                              "px-3 text-right font-mono tabular-nums",
                            )}
                          >
                            {formatInr(line.avgUnitCost)}
                          </td>
                          <td
                            className={cn(
                              procurementUi.td,
                              "px-3 font-mono text-xs text-muted-foreground",
                            )}
                            title={line.serialSummary}
                          >
                            <span className="line-clamp-2 break-all">{line.serialSummary}</span>
                          </td>
                          <td
                            className={cn(
                              procurementUi.td,
                              "px-3 font-mono text-xs tabular-nums text-muted-foreground",
                            )}
                            title={line.grnSummary}
                          >
                            <span className="line-clamp-2 break-all">{line.grnSummary}</span>
                            {line.hasReversal ? (
                              <span className="mt-1 inline-flex rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                                Reversed
                              </span>
                            ) : null}
                          </td>
                          <td
                            className={cn(
                              procurementUi.td,
                              "px-3 whitespace-nowrap text-xs text-muted-foreground",
                            )}
                          >
                            {formatInventoryDateAdded(line.dateAdded)}
                          </td>
                          <td
                            className={cn(
                              procurementUi.td,
                              "px-3 whitespace-nowrap text-xs font-medium",
                              line.warrantyExpired
                                ? "text-destructive"
                                : "text-muted-foreground",
                            )}
                          >
                            {formatInventoryWarrantyLabel(line.warrantyValidTill)}
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
      )}

      <InventoryProductDetailDialog
        open={Boolean(detailProductKey && detailProduct)}
        product={detailProduct}
        onClose={() => setDetailProductKey(null)}
        onRefresh={() => void load(true)}
        onError={setDetailError}
      />

      <ProcurementInventoryAddStockDialog
        open={addOpen}
        busy={addBusy}
        error={addError}
        onClose={() => {
          if (!addBusy) setAddOpen(false);
        }}
        onConfirm={(lines) => void onConfirmAddStock(lines)}
      />

      <ProcurementInventoryImportDialog
        open={importOpen}
        purchaseOrders={purchaseOrders}
        busy={importBusy}
        error={importError}
        onClose={() => {
          if (!importBusy) setImportOpen(false);
        }}
        onConfirm={(draft) => void onConfirmImport(draft)}
    />
    </div>
  );
}
