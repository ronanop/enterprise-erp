"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Package, RefreshCw, Upload } from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
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
  importProcurementInventory,
  invalidateProcurementListCache,
  listProcurementInventory,
  listPurchaseOrders,
  listVendorOptions,
  type ProcOrder,
  type ProcurementInventoryRow,
  type VendorOption,
} from "@/services/procurement-service";
import { buildProcurementInventoryStockSummary } from "@/utils/procurement-inventory-report";
import {
  formatGrnProductSummary,
  formatGrnSerialSummary,
  groupInventoryByPoAndGrn,
} from "@/utils/procurement-inventory-grouping";

function formatReceiptDate(value: string | null): string {
  if (!value) return "—";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

export function ProcurementInventoryListPage() {
  const [rows, setRows] = useState<ProcurementInventoryRow[]>([]);
  const [vendors, setVendors] = useState<Record<string, VendorOption>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<ProcOrder[]>([]);

  const load = useCallback(async (force = false) => {
    if (force) invalidateProcurementListCache();
    setLoading(true);
    setError(null);
    try {
      const [inventory, vendorRows, orders] = await Promise.all([
        listProcurementInventory(),
        listVendorOptions().catch(() => [] as VendorOption[]),
        listPurchaseOrders().catch(() => [] as ProcOrder[]),
      ]);
      setRows(inventory);
      setVendors(Object.fromEntries(vendorRows.map((v) => [v.id, v])));
      setPurchaseOrders(orders);
    } catch (err) {
      setRows([]);
      setError(formatApiError(err, "Failed to load procurement inventory"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const vendor = row.vendor_id ? (vendors[row.vendor_id]?.label ?? "") : "";
      return [row.grn_number, row.company_po_number, vendor, row.product_name, row.serial_number]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, vendors]);

  const reportSource = query.trim() ? filtered : rows;
  const stockSummary = useMemo(
    () => buildProcurementInventoryStockSummary(reportSource),
    [reportSource],
  );

  const poGroups = useMemo(() => groupInventoryByPoAndGrn(filtered), [filtered]);

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
              disabled={loading}
              onClick={() => void load(true)}
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

      <ProcurementListSearch
        value={query}
        onChange={setQuery}
        placeholder="Search GRN, PO, vendor, product, serial…"
        aria-label="Search procurement inventory"
      />

      {!loading && rows.length > 0 ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FinanceKpiCard
              label="Units in stock"
              value={loading ? "—" : String(stockSummary.totalUnits)}
              hint={query.trim() ? "Matching current search" : "One row per received unit"}
              icon={Boxes}
            />
            <FinanceKpiCard
              label="Products"
              value={loading ? "—" : String(stockSummary.productCount)}
              hint="Distinct product names"
              icon={Package}
            />
          </div>

          <div className={procurementUi.sectionCard}>
            <p className={procurementUi.sectionTitle}>Stock quantity by product</p>
            {stockSummary.byProduct.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stock rows to summarize.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="border-b border-border/60 bg-muted/20 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 text-right">Units in stock</th>
                      <th className="px-3 py-2 text-right">GRNs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockSummary.byProduct.map((line) => (
                      <tr
                        key={line.productName}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="cursor-pointer text-left font-medium text-foreground transition-colors duration-200 hover:text-[#0369A1] hover:underline"
                            onClick={() => setQuery(line.productName)}
                          >
                            {line.productName}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">
                          {line.units}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {line.grnCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className={procurementUi.sectionCard}>
        <p className={procurementUi.sectionTitle}>GRN detail</p>
        <div className={procurementUi.tableScroll}>
          <table className={cn(procurementUi.table, "min-w-[800px]")}>
            <thead className={procurementUi.thead}>
              <tr>
                <th className={procurementUi.th}>PO</th>
                <th className={procurementUi.th}>GRN</th>
                <th className={procurementUi.th}>GRN date</th>
                <th className={procurementUi.th}>Vendor</th>
                <th className={procurementUi.th}>Products</th>
                <th className={cn(procurementUi.th, "text-right")}>Units</th>
                <th className={procurementUi.th}>Serial numbers</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={procurementUi.empty}>
                    {loading
                      ? "Loading inventory…"
                      : rows.length === 0
                        ? "No GRN receipts yet. Save a receipt with serials on a purchase order first."
                        : "No rows match your search."}
                  </td>
                </tr>
              ) : null}
              {poGroups.flatMap((po, poIndex) => {
                const bandRow =
                  poIndex % 2 === 0
                    ? "bg-muted/30 hover:bg-muted/40"
                    : "bg-sky-50/45 hover:bg-sky-50/65";
                const bandPoCell =
                  poIndex % 2 === 0 ? "bg-muted/45" : "bg-sky-100/55";
                return po.grns.map((grn, grnIndex) => (
                  <tr
                    key={`${po.company_po_number}-${grn.grn_number}`}
                    className={cn(
                      "border-b border-border/45 transition-colors duration-150",
                      bandRow,
                      grnIndex === 0 && poIndex > 0 && "border-t-2 border-t-border/70",
                    )}
                  >
                    {grnIndex === 0 ? (
                      <td
                        rowSpan={po.grns.length}
                        className={cn(
                          procurementUi.td,
                          bandPoCell,
                          "align-top border-r border-border/50 font-semibold tabular-nums text-foreground",
                        )}
                      >
                        {po.company_po_number}
                      </td>
                    ) : null}
                    <td className={cn(procurementUi.tdNumeric, "tabular-nums font-medium text-foreground")}>
                      {grn.grn_number}
                    </td>
                    <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                      {formatReceiptDate(grn.receipt_at)}
                    </td>
                    <td className={procurementUi.tdMuted}>
                      {grn.vendor_id ? (vendors[grn.vendor_id]?.label ?? "—") : "—"}
                    </td>
                    <td className={cn(procurementUi.td, "max-w-[280px]")}>
                      <span className="line-clamp-3" title={formatGrnProductSummary(grn.lines)}>
                        {formatGrnProductSummary(grn.lines)}
                      </span>
                    </td>
                    <td className={cn(procurementUi.tdNumeric, "text-right tabular-nums font-medium")}>
                      {grn.totalUnits}
                    </td>
                    <td
                      className={cn(
                        procurementUi.td,
                        "max-w-[200px] font-mono text-xs text-muted-foreground",
                      )}
                      title={formatGrnSerialSummary(grn.lines)}
                    >
                      <span className="line-clamp-2">{formatGrnSerialSummary(grn.lines)}</span>
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>

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
