"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, IndianRupee, Package, RefreshCw, Upload } from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { ProcurementInventoryCharts } from "@/components/procurement/procurement-inventory-charts";
import {
  ProcurementInventoryImportDialog,
  INVENTORY_WITHOUT_PO,
  type InventoryImportDraftRow,
} from "@/components/procurement/procurement-inventory-import-dialog";
import {
  ProcurementListSearch,
  ProcurementPageHeader,
} from "@/components/procurement/procurement-page-header";
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
  groupGrnStockByProduct,
  isInventoryLedgerRow,
} from "@/utils/procurement-inventory-report";
import { InventoryProductDetailDialog } from "@/components/procurement/inventory-product-detail-dialog";
import { textTokenMatch } from "@/utils/procurement-search";

export function ProcurementInventoryListPage() {
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
    void load();
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

  return (
    <div className={procurementUi.page}>
      <ProcurementPageHeader
        title="Inventory"
        actions={
          <div className="flex flex-wrap gap-2">
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

      <ProcurementListSearch
        value={query}
        onChange={setQuery}
        placeholder="Search by product…"
        aria-label="Search inventory by product"
      />

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
            <p className={procurementUi.sectionTitle}>GRN stock by product</p>
            {grnStockRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No GRN stock on hand. Units appear here when you receive on a GRN but do not bill
                the full quantity on the vendor invoice.
              </p>
            ) : (
              <div className={procurementUi.tableShell}>
                <div className={procurementUi.tableScroll}>
                  <table
                    className={cn(
                      procurementUi.table,
                      "min-w-[960px] border-separate border-spacing-0",
                    )}
                  >
                    <thead className={procurementUi.thead}>
                      <tr>
                        <th className={cn(procurementUi.th, "px-4")}>Product</th>
                        <th className={cn(procurementUi.th, "px-4 text-right")}>Stock qty</th>
                        <th className={cn(procurementUi.th, "px-4")}>Description</th>
                        <th className={cn(procurementUi.th, "px-4 text-right")}>Vendor price</th>
                        <th className={cn(procurementUi.th, "px-4")}>Serial number</th>
                        <th className={cn(procurementUi.th, "px-4")}>GRN number</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grnStockByProduct.map((line) => (
                        <tr key={line.productKey} className={procurementUi.tr}>
                          <td className={cn(procurementUi.td, "px-4")}>
                            <button
                              type="button"
                              className="cursor-pointer text-left font-medium text-foreground transition-colors duration-200 hover:text-[#0369A1] hover:underline"
                              onClick={() => {
                                setDetailError(null);
                                setDetailProductKey(line.productKey);
                              }}
                            >
                              {line.productName}
                            </button>
                          </td>
                          <td
                            className={cn(
                              procurementUi.tdNumeric,
                              "px-4 text-right font-mono tabular-nums",
                              line.stockQty < 0 ? "text-destructive" : "text-foreground",
                            )}
                          >
                            {line.stockQty.toLocaleString("en-IN")}
                          </td>
                          <td
                            className={cn(
                              procurementUi.td,
                              "px-4 max-w-[220px] text-muted-foreground",
                            )}
                          >
                            <span className="line-clamp-2" title={line.description}>
                              {line.description}
                            </span>
                          </td>
                          <td
                            className={cn(
                              procurementUi.tdNumeric,
                              "px-4 text-right font-mono tabular-nums",
                            )}
                          >
                            {formatInr(line.avgUnitCost)}
                          </td>
                          <td
                            className={cn(
                              procurementUi.td,
                              "px-4 min-w-[140px] font-mono text-xs text-muted-foreground",
                            )}
                            title={line.serialSummary}
                          >
                            <span className="line-clamp-2">{line.serialSummary}</span>
                          </td>
                          <td
                            className={cn(
                              procurementUi.td,
                              "px-4 font-mono text-xs tabular-nums text-muted-foreground",
                            )}
                            title={line.grnSummary}
                          >
                            <span className="line-clamp-2">{line.grnSummary}</span>
                            {line.hasReversal ? (
                              <span className="ml-2 rounded-full border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                                Reversed
                              </span>
                            ) : null}
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
