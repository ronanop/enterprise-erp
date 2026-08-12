"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Package, Plus, RefreshCw, Upload } from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import {
  ProcurementInventoryImportDialog,
  INVENTORY_WITHOUT_PO,
  type InventoryImportDraftRow,
} from "@/components/procurement/procurement-inventory-import-dialog";
import { InventorySerialEditor } from "@/components/procurement/inventory-serial-editor";
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
import { buildProcurementInventoryStockSummary, inventoryRowStableKey, isGrnNonBilledStockRow, nonBilledStockQuantity } from "@/utils/procurement-inventory-report";

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
  const [serialSaveError, setSerialSaveError] = useState<string | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<ProcOrder[]>([]);

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
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const vendor = row.vendor_id ? (vendors[row.vendor_id]?.label ?? "") : "";
      return [row.grn_number, row.company_po_number, vendor, row.product_name, row.serial_number, String(row.unit_index)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, vendors]);

  const reportSource = query.trim() ? filtered : rows;
  const grnStockRows = useMemo(
    () => reportSource.filter(isGrnNonBilledStockRow),
    [reportSource],
  );
  const grnStockTableRows = useMemo(() => {
    return [...grnStockRows].sort((a, b) => {
      const product = (a.product_name ?? "").localeCompare(b.product_name ?? "", undefined, {
        sensitivity: "base",
      });
      if (product !== 0) return product;
      const po = (a.company_po_number ?? "").localeCompare(b.company_po_number ?? "", undefined, {
        numeric: true,
      });
      if (po !== 0) return po;
      const line = (a.line_number ?? 0) - (b.line_number ?? 0);
      if (line !== 0) return line;
      return (a.unit_index ?? 0) - (b.unit_index ?? 0);
    });
  }, [grnStockRows]);
  const stockSummary = useMemo(
    () => buildProcurementInventoryStockSummary(grnStockRows),
    [grnStockRows],
  );

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
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading}
              onClick={() => router.push("/procurement/inventory/create-po")}
            >
              <Plus className="mr-1.5 size-3.5" />
              Create purchase order
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

      {serialSaveError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {serialSaveError}
        </div>
      ) : null}

      <ProcurementListSearch
        value={query}
        onChange={setQuery}
        placeholder="Search GRN, PO, vendor, product, serial…"
        aria-label="Search procurement inventory"
      />

      {loading ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-[118px] animate-pulse rounded-md border border-border/60 bg-muted/20" />
            <div className="h-[118px] animate-pulse rounded-md border border-border/60 bg-muted/20" />
          </div>
          <div className="h-32 animate-pulse rounded-md border border-border/60 bg-muted/20" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FinanceKpiCard
              label="Units in stock"
              value={String(stockSummary.totalUnits)}
              icon={Boxes}
            />
            <FinanceKpiCard
              label="Products"
              value={String(stockSummary.productCount)}
              icon={Package}
            />
          </div>

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
                      {grnStockTableRows.map((line, index) => (
                        <tr
                          key={inventoryRowStableKey(line, index)}
                          className={procurementUi.tr}
                        >
                          <td className={cn(procurementUi.td, "px-4")}>
                            <button
                              type="button"
                              className="cursor-pointer text-left font-medium text-foreground transition-colors duration-200 hover:text-[#0369A1] hover:underline"
                              onClick={() => setQuery(line.product_name ?? "")}
                            >
                              {line.product_name?.trim() || "—"}
                            </button>
                          </td>
                          <td
                            className={cn(
                              procurementUi.tdNumeric,
                              "px-4 text-right font-mono tabular-nums text-foreground",
                            )}
                          >
                            {nonBilledStockQuantity(line).toLocaleString("en-IN")}
                          </td>
                          <td
                            className={cn(
                              procurementUi.td,
                              "px-4 max-w-[200px] text-muted-foreground",
                            )}
                          >
                            <span className="line-clamp-2" title={line.description ?? ""}>
                              {line.description?.trim() || "—"}
                            </span>
                          </td>
                          <td
                            className={cn(
                              procurementUi.tdNumeric,
                              "px-4 text-right font-mono tabular-nums",
                            )}
                          >
                            {formatInr(Number(line.unit_cost) || 0)}
                          </td>
                          <td className={cn(procurementUi.td, "px-4 min-w-[140px]")}>
                            <InventorySerialEditor
                              row={line}
                              onSaved={() => void load(true)}
                              onError={setSerialSaveError}
                            />
                          </td>
                          <td
                            className={cn(
                              procurementUi.td,
                              "px-4 font-mono text-xs tabular-nums text-muted-foreground",
                            )}
                          >
                            {line.grn_number}
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
