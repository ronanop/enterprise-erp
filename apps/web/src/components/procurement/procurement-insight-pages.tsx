"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Boxes,
  ChevronDown,
  ClipboardList,
  Download,
  FileSpreadsheet,
  IndianRupee,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import {
  ProcurementErrorBanner,
  ProcurementPage,
  procurementUi,
} from "@/components/procurement/procurement-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  formatInr,
  invalidateProcurementListCache,
  listProcurementInventory,
  listPurchaseOrders,
  listScmQueue,
  listVendorOptions,
  listVendorPos,
  type ProcOrder,
  type ProcurementInventoryRow,
  type ScmQueueItem,
  type ScmVendorPo,
  type VendorOption,
} from "@/services/procurement-service";
import { buildGrnExportRowsWithBatches, exportGrnsXlsx } from "@/utils/grns-excel-export";
import { grnBadgeVariant } from "@/utils/grn-status-display";
import { buildOrderExportRows, exportOrdersXlsx } from "@/utils/orders-excel-export";
import {
  buildProcurementInventoryStockSummary,
  isInventoryLedgerRow,
} from "@/utils/procurement-inventory-report";
import { buildProcurementPipelineMetrics } from "@/utils/procurement-pipeline-metrics";
import {
  buildPoGrnBillingRows,
} from "@/utils/procurement-po-grn-billing";
import { countPoBuckets, deriveGrnStatus, emptyPoBucketCounts, poOverviewBucketForOrder, type PoOverviewBucket } from "@/utils/procurement-po-buckets";
import { isScmOpenOvfRow } from "@/utils/scm-queue-ovf-status";

function stampNow(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function downloadWorkbook(
  filename: string,
  sheets: Array<{ name: string; rows: Record<string, string | number>[] }>,
) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const data =
      sheet.rows.length > 0
        ? sheet.rows
        : [{ Note: "No rows available for this export." }];
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadSheet(
  filename: string,
  rows: Record<string, string | number>[],
  sheetName: string,
) {
  downloadWorkbook(filename, [{ name: sheetName, rows }]);
}

type InsightData = {
  orders: ProcOrder[];
  vendorPos: ScmVendorPo[];
  inventory: ProcurementInventoryRow[];
  scmQueue: ScmQueueItem[];
  vendors: Record<string, VendorOption>;
};

function useProcurementInsightData() {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (force) invalidateProcurementListCache();
    if (!data) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [orders, vendorPos, inventory, scmQueue, vendorRows] = await Promise.all([
        listPurchaseOrders({ includeCommercial: true }),
        listVendorPos(),
        listProcurementInventory(),
        listScmQueue(),
        listVendorOptions(),
      ]);
      setData({
        orders,
        vendorPos,
        inventory,
        scmQueue,
        vendors: Object.fromEntries(vendorRows.map((v) => [v.id, v])),
      });
    } catch (err) {
      setError(formatApiError(err, "Failed to load procurement insight data"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only initial load
  }, []);

  return { data, loading, refreshing, error, reload: load };
}

type ReportTint = "sky" | "amber" | "emerald" | "teal" | "orange" | "slate";

const REPORT_TINT: Record<ReportTint, { card: string; icon: string }> = {
  sky: {
    card: "border-sky-200/80 bg-sky-50/70 hover:border-sky-300/90 hover:bg-sky-50",
    icon: "border-sky-200/70 bg-sky-100 text-sky-800",
  },
  amber: {
    card: "border-amber-200/80 bg-amber-50/70 hover:border-amber-300/90 hover:bg-amber-50",
    icon: "border-amber-200/70 bg-amber-100 text-amber-800",
  },
  emerald: {
    card: "border-emerald-200/80 bg-emerald-50/70 hover:border-emerald-300/90 hover:bg-emerald-50",
    icon: "border-emerald-200/70 bg-emerald-100 text-emerald-800",
  },
  teal: {
    card: "border-teal-200/80 bg-teal-50/70 hover:border-teal-300/90 hover:bg-teal-50",
    icon: "border-teal-200/70 bg-teal-100 text-teal-800",
  },
  orange: {
    card: "border-orange-200/80 bg-orange-50/70 hover:border-orange-300/90 hover:bg-orange-50",
    icon: "border-orange-200/70 bg-orange-100 text-orange-800",
  },
  slate: {
    card: "border-slate-200/80 bg-slate-50/80 hover:border-slate-300/90 hover:bg-slate-50",
    icon: "border-slate-200/70 bg-slate-100 text-slate-800",
  },
};

type ReportCard = {
  id: string;
  title: string;
  description: string;
  icon: typeof FileSpreadsheet;
  tint: ReportTint;
  href?: string;
  countLabel: string;
  onExport: () => Promise<void>;
};

export function ProcurementReportsPage() {
  const { data, loading, refreshing, error, reload } = useProcurementInsightData();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [statusQuery, setStatusQuery] = useState("");

  const stockRows = useMemo(
    () => (data?.inventory ?? []).filter(isInventoryLedgerRow),
    [data],
  );
  const issuedPos = useMemo(
    () =>
      (data?.vendorPos ?? []).filter((po) => {
        const status = (po.status || "").toLowerCase();
        return status !== "draft" && status !== "submitted" && status !== "cancelled";
      }),
    [data],
  );
  const buckets = useMemo(
    () => (data?.orders ? countPoBuckets(data.orders) : emptyPoBucketCounts()),
    [data],
  );

  const poStatusRows = useMemo(() => {
    if (!data) return [];
    return buildPoGrnBillingRows(data.vendorPos, data.inventory, data.vendors);
  }, [data]);

  const filteredPoStatusRows = useMemo(() => {
    const q = statusQuery.trim().toLowerCase();
    if (!q) return poStatusRows;
    return poStatusRows.filter((row) => row.companyPo.toLowerCase().includes(q));
  }, [poStatusRows, statusQuery]);

  async function runExport(id: string, action: () => Promise<void>) {
    setBusyId(id);
    setExportError(null);
    try {
      await action();
    } catch (err) {
      setExportError(formatApiError(err, "Export failed"));
    } finally {
      setBusyId(null);
    }
  }

  const cards: ReportCard[] = [
    {
      id: "orders-all",
      title: "Purchase orders",
      description: "Full commercial PO workbook — vendor, customer, margin, status.",
      icon: ShoppingCart,
      tint: "sky",
      href: "/procurement/orders",
      countLabel: loading ? "…" : `${(data?.orders.length ?? 0).toLocaleString("en-IN")} POs`,
      onExport: async () => {
        if (!data) return;
        const rows = buildOrderExportRows(data.orders, data.vendors);
        await exportOrdersXlsx(`purchase-orders-${stampNow()}.xlsx`, rows);
      },
    },
    {
      id: "orders-open",
      title: "Open / partial POs",
      description: "POs still awaiting full goods receipt.",
      icon: PackageCheck,
      tint: "amber",
      href: "/procurement/orders?bucket=open",
      countLabel: loading
        ? "…"
        : `${(buckets.open + buckets.partial).toLocaleString("en-IN")} open+partial`,
      onExport: async () => {
        if (!data) return;
        const subset = data.orders.filter((order) => {
          const bucket = poOverviewBucketForOrder(order);
          return bucket === "open" || bucket === "partial";
        });
        const rows = buildOrderExportRows(subset, data.vendors);
        await exportOrdersXlsx(`purchase-orders-open-partial-${stampNow()}.xlsx`, rows);
      },
    },
    {
      id: "orders-closed",
      title: "Closed PO",
      description: "Purchase orders with full goods receipt.",
      icon: PackageCheck,
      tint: "emerald",
      href: "/procurement/orders?bucket=close",
      countLabel: loading ? "…" : `${buckets.close.toLocaleString("en-IN")} closed`,
      onExport: async () => {
        if (!data) return;
        const subset = data.orders.filter((order) => poOverviewBucketForOrder(order) === "close");
        const rows = buildOrderExportRows(subset, data.vendors);
        await exportOrdersXlsx(`purchase-orders-closed-${stampNow()}.xlsx`, rows);
      },
    },
    {
      id: "inventory",
      title: "Inventory",
      description: "Non-billed GRN stock units — product, serial, PO, GRN, unit cost.",
      icon: Boxes,
      tint: "teal",
      href: "/procurement/inventory",
      countLabel: loading ? "…" : `${stockRows.length.toLocaleString("en-IN")} units`,
      onExport: async () => {
        if (!data) return;
        const rows = stockRows.map((row, index) => ({
          "#": index + 1,
          Product: row.product_name ?? "",
          Description: row.description ?? "",
          "Stock qty": 1,
          "Unit cost": Number(row.unit_cost) || 0,
          "Serial number": row.serial_number ?? "",
          "Company PO": row.company_po_number ?? "",
          "GRN number": row.grn_number ?? "",
          Vendor: row.vendor_id ? data.vendors[row.vendor_id]?.label || row.vendor_id : "",
        }));
        downloadSheet(`inventory-on-hand-${stampNow()}.xlsx`, rows, "Inventory");
      },
    },
    {
      id: "grns",
      title: "GRN receipt status",
      description: "Vendor PO receipt status with line-level ordered vs received.",
      icon: PackageCheck,
      tint: "orange",
      href: "/procurement/grns",
      countLabel: loading ? "…" : `${issuedPos.length.toLocaleString("en-IN")} issued POs`,
      onExport: async () => {
        if (!data) return;
        const rows = await buildGrnExportRowsWithBatches(
          issuedPos,
          data.vendors,
          data.inventory,
        );
        await exportGrnsXlsx(`grn-receipt-status-${stampNow()}.xlsx`, rows);
      },
    },
    {
      id: "complete",
      title: "Complete report",
      description:
        "All five reports in one workbook — POs, open/partial, closed, inventory, GRN.",
      icon: FileSpreadsheet,
      tint: "slate",
      countLabel: loading ? "…" : "All reports",
      onExport: async () => {
        if (!data) return;
        const openPartial = data.orders.filter((order) => {
          const bucket = poOverviewBucketForOrder(order);
          return bucket === "open" || bucket === "partial";
        });
        const closed = data.orders.filter(
          (order) => poOverviewBucketForOrder(order) === "close",
        );
        const inventoryRows = stockRows.map((row, index) => ({
          "#": index + 1,
          Product: row.product_name ?? "",
          Description: row.description ?? "",
          "Stock qty": 1,
          "Unit cost": Number(row.unit_cost) || 0,
          "Serial number": row.serial_number ?? "",
          "Company PO": row.company_po_number ?? "",
          "GRN number": row.grn_number ?? "",
          Vendor: row.vendor_id ? data.vendors[row.vendor_id]?.label || row.vendor_id : "",
        }));
        const grnRows = await buildGrnExportRowsWithBatches(
          issuedPos,
          data.vendors,
          data.inventory,
        );
        downloadWorkbook(`procurement-complete-report-${stampNow()}.xlsx`, [
          {
            name: "Purchase orders",
            rows: buildOrderExportRows(data.orders, data.vendors),
          },
          {
            name: "Open partial POs",
            rows: buildOrderExportRows(openPartial, data.vendors),
          },
          {
            name: "Closed PO",
            rows: buildOrderExportRows(closed, data.vendors),
          },
          { name: "Inventory", rows: inventoryRows },
          { name: "GRN receipt status", rows: grnRows },
        ]);
      },
    },
  ];

  return (
    <ProcurementPage>
      <ProcurementPageHeader
        title="Reports"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            disabled={loading || refreshing}
            onClick={() => void reload(true)}
          >
            <RefreshCw
              className={cn("mr-1.5 size-3.5", (loading || refreshing) && "animate-spin")}
            />
            Refresh
          </Button>
        }
      />

      {error ? <ProcurementErrorBanner>{error}</ProcurementErrorBanner> : null}
      {exportError ? <ProcurementErrorBanner>{exportError}</ProcurementErrorBanner> : null}

      <section className="space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold uppercase tracking-tight text-foreground">
              Purchase order fulfillment
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Input
              type="search"
              value={statusQuery}
              onChange={(e) => setStatusQuery(e.target.value)}
              placeholder="Search by PO number…"
              aria-label="Search by company PO number"
              className={cn(procurementUi.searchInput, "w-[220px] shrink-0")}
            />
          </div>
        </div>

        <div className={procurementUi.tableShell}>
          <div className={procurementUi.tableScroll}>
            <table className={cn(procurementUi.table, "min-w-[1180px]")}>
              <thead className={procurementUi.thead}>
                <tr>
                  <th className={cn(procurementUi.th, "px-3")}>Company PO</th>
                  <th className={cn(procurementUi.th, "px-3")}>Vendor</th>
                  <th className={cn(procurementUi.th, "px-3")}>GRN status</th>
                  <th className={cn(procurementUi.th, "px-3")}>DC bill status</th>
                  <th className={cn(procurementUi.th, "px-3 text-right")}>GRNs</th>
                  <th className={cn(procurementUi.th, "px-3 text-right")}>Ordered</th>
                  <th className={cn(procurementUi.th, "px-3 text-right")}>Received</th>
                  <th className={cn(procurementUi.th, "px-3 text-right")}>Remaining</th>
                  <th className={cn(procurementUi.th, "px-3 text-right")}>Billed</th>
                  <th className={cn(procurementUi.th, "px-3")}>GRN numbers</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className={procurementUi.empty}>
                      Loading PO status…
                    </td>
                  </tr>
                ) : filteredPoStatusRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className={procurementUi.empty}>
                      No issued purchase orders match this filter.
                    </td>
                  </tr>
                ) : (
                  filteredPoStatusRows.map((row) => (
                    <tr key={row.orderId} className={procurementUi.tr}>
                      <td className={cn(procurementUi.td, "px-3")}>
                        <Link
                          href={`/procurement/orders/${row.orderId}`}
                          className="cursor-pointer font-medium text-foreground transition-colors duration-200 hover:text-[#0369A1] hover:underline"
                        >
                          {row.companyPo}
                        </Link>
                      </td>
                      <td className={cn(procurementUi.td, "px-3")}>{row.vendor}</td>
                      <td className={cn(procurementUi.td, "px-3")}>
                        <Badge variant={grnBadgeVariant(row.grnStatusKey)} className="uppercase">
                          {row.grnStatus}
                        </Badge>
                      </td>
                      <td className={cn(procurementUi.td, "px-3")}>{row.dcBillStatus}</td>
                      <td
                        className={cn(
                          procurementUi.tdNumeric,
                          "px-3 text-right font-mono font-medium",
                        )}
                      >
                        {row.grnDocuments.toLocaleString("en-IN")}
                      </td>
                      <td className={cn(procurementUi.tdNumeric, "px-3 text-right font-mono")}>
                        {row.qtyOrdered.toLocaleString("en-IN")}
                      </td>
                      <td className={cn(procurementUi.tdNumeric, "px-3 text-right font-mono")}>
                        {row.qtyReceived.toLocaleString("en-IN")}
                      </td>
                      <td className={cn(procurementUi.tdNumeric, "px-3 text-right font-mono")}>
                        {row.qtyRemaining.toLocaleString("en-IN")}
                      </td>
                      <td className={cn(procurementUi.tdNumeric, "px-3 text-right font-mono")}>
                        {row.qtyBilled.toLocaleString("en-IN")}
                      </td>
                      <td className={cn(procurementUi.td, "px-3")}>
                        {row.grnNumbers.length === 0 ? (
                          <span className="font-mono text-xs text-muted-foreground">—</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {row.grnNumbers.map((grn) => (
                              <li
                                key={grn}
                                className="font-mono text-xs tabular-nums text-muted-foreground"
                              >
                                {grn}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const busy = busyId === card.id;
          const tint = REPORT_TINT[card.tint];
          return (
            <div
              key={card.id}
              className={cn(
                "flex h-full flex-col rounded-xl border p-4 shadow-sm transition-[box-shadow,border-color,background-color] duration-200 hover:shadow-md",
                tint.card,
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border",
                    tint.icon,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    {card.title}
                  </h2>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button
                  type="button"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  disabled={loading || busy || !data}
                  onClick={() => void runExport(card.id, card.onExport)}
                >
                  <Download className="mr-1.5 size-3.5" />
                  {busy ? "Exporting…" : "Export Excel"}
                </Button>
                {card.href ? (
                  <Link
                    href={card.href}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "cursor-pointer transition-colors duration-200",
                    )}
                  >
                    Open
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </ProcurementPage>
  );
}

const ANALYTICS_STAT_TINT = {
  sky: {
    card: "border-sky-200/80 bg-sky-50/70",
    label: "text-sky-800",
    value: "text-sky-950",
    icon: "border-sky-200/70 bg-sky-100 text-sky-800",
  },
  amber: {
    card: "border-amber-200/80 bg-amber-50/70",
    label: "text-amber-800",
    value: "text-amber-950",
    icon: "border-amber-200/70 bg-amber-100 text-amber-800",
  },
  orange: {
    card: "border-orange-200/80 bg-orange-50/70",
    label: "text-orange-800",
    value: "text-orange-950",
    icon: "border-orange-200/70 bg-orange-100 text-orange-800",
  },
  emerald: {
    card: "border-emerald-200/80 bg-emerald-50/70",
    label: "text-emerald-800",
    value: "text-emerald-950",
    icon: "border-emerald-200/70 bg-emerald-100 text-emerald-800",
  },
} as const;

type AnalyticsStatTint = keyof typeof ANALYTICS_STAT_TINT;

const VENDOR_PO_STATUS_LABEL: Record<PoOverviewBucket, string> = {
  draft: "Draft",
  open: "Open",
  partial: "Partial",
  close: "Completed",
};

const VENDOR_PO_STATUS_BADGE: Record<
  PoOverviewBucket,
  "secondary" | "outline" | "warning" | "success"
> = {
  draft: "secondary",
  open: "outline",
  partial: "warning",
  close: "success",
};

const VENDOR_BAR_COLORS = [
  "#0369A1",
  "#0F766E",
  "#B45309",
  "#C2410C",
  "#047857",
  "#475569",
  "#A16207",
  "#0284C7",
] as const;

function AnalyticsStat({
  label,
  value,
  tint,
  icon: Icon,
}: {
  label: string;
  value: string;
  tint: AnalyticsStatTint;
  icon: LucideIcon;
}) {
  const styles = ANALYTICS_STAT_TINT[tint];
  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3 shadow-sm transition-[box-shadow,border-color] duration-200 hover:shadow-md",
        styles.card,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-[11px] font-semibold uppercase tracking-wide", styles.label)}>
          {label}
        </p>
        <span
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border",
            styles.icon,
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>
      <p
        className={cn(
          "mt-1.5 font-mono text-xl font-semibold tabular-nums",
          styles.value,
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function ProcurementAnalyticsPage() {
  const { data, loading, refreshing, error, reload } = useProcurementInsightData();
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);

  const pipelineMetrics = useMemo(
    () =>
      buildProcurementPipelineMetrics({
        scmQueueCount: data?.scmQueue.length ?? 0,
        vendorPos: data?.vendorPos ?? [],
      }),
    [data],
  );

  const buckets = useMemo(
    () => (data?.orders ? countPoBuckets(data.orders) : emptyPoBucketCounts()),
    [data],
  );

  const stockSummary = useMemo(() => {
    if (!data) return null;
    const labels: Record<string, string> = {};
    for (const [id, vendor] of Object.entries(data.vendors)) {
      labels[id] = vendor.label;
    }
    return buildProcurementInventoryStockSummary(
      data.inventory.filter(isInventoryLedgerRow),
      { vendorLabels: labels },
    );
  }, [data]);

  const openOvf = useMemo(
    () => (data?.scmQueue ?? []).filter((row) => isScmOpenOvfRow(row)).length,
    [data],
  );

  const vendorSpend = useMemo(() => {
    if (!data) return [];
    const map = new Map<
      string,
      {
        vendorId: string;
        label: string;
        amount: number;
        orders: number;
        pos: Array<{
          id: string;
          companyPo: string;
          amount: number;
          fulfillment: PoOverviewBucket;
        }>;
      }
    >();
    for (const order of data.orders) {
      const status = (order.status || "").toLowerCase();
      if (status === "draft" || status === "cancelled") continue;
      const label = data.vendors[order.vendor_id]?.label || order.vendor_id;
      const amount = Number(order.vendor_total) || Number(order.total_amount) || 0;
      const companyPo = (order.company_po_number || order.document_number || "—").trim();
      const fulfillment = poOverviewBucketForOrder(order, deriveGrnStatus(order)) ?? "open";
      const entry = map.get(order.vendor_id) ?? {
        vendorId: order.vendor_id,
        label,
        amount: 0,
        orders: 0,
        pos: [],
      };
      entry.amount += amount;
      entry.orders += 1;
      entry.pos.push({
        id: order.id,
        companyPo,
        amount,
        fulfillment,
      });
      map.set(order.vendor_id, entry);
    }
    return Array.from(map.values())
      .map((row) => ({
        ...row,
        pos: [...row.pos].sort((a, b) =>
          a.companyPo.localeCompare(b.companyPo, undefined, { numeric: true }),
        ),
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [data]);

  const vendorHistogram = useMemo(
    () =>
      vendorSpend.map((row) => ({
        vendorId: row.vendorId,
        name:
          row.label.length > 14 ? `${row.label.slice(0, 12).trimEnd()}…` : row.label,
        fullName: row.label,
        amount: Math.round(row.amount * 100) / 100,
        orders: row.orders,
      })),
    [vendorSpend],
  );

  return (
    <ProcurementPage>
      <ProcurementPageHeader
        title="Analytics"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading || refreshing}
              onClick={() => void reload(true)}
            >
              <RefreshCw
                className={cn("mr-1.5 size-3.5", (loading || refreshing) && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        }
      />

      {error ? <ProcurementErrorBanner>{error}</ProcurementErrorBanner> : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsStat
          label="Open OVF"
          value={loading ? "—" : openOvf.toLocaleString("en-IN")}
          tint="sky"
          icon={ClipboardList}
        />
        <AnalyticsStat
          label="Open PO"
          value={loading ? "—" : buckets.open.toLocaleString("en-IN")}
          tint="amber"
          icon={ShoppingCart}
        />
        <AnalyticsStat
          label="GRN documents"
          value={loading ? "—" : pipelineMetrics.grns.toLocaleString("en-IN")}
          tint="orange"
          icon={PackageCheck}
        />
        <AnalyticsStat
          label="Stock value"
          value={loading || !stockSummary ? "—" : formatInr(stockSummary.totalStockValue)}
          tint="emerald"
          icon={IndianRupee}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[58fr_42fr]">
        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="size-3.5 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Top vendors by PO value
            </h2>
          </div>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : vendorSpend.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No issued purchase orders yet.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {vendorSpend.map((row) => {
                const expanded = expandedVendorId === row.vendorId;
                return (
                  <li key={row.vendorId} className="min-w-0">
                    <button
                      type="button"
                      className="w-full cursor-pointer rounded-lg text-left transition-colors duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? "Hide" : "Show"} purchase orders for ${row.label}`}
                      onClick={() =>
                        setExpandedVendorId((prev) =>
                          prev === row.vendorId ? null : row.vendorId,
                        )
                      }
                    >
                      <div className="flex items-center justify-between gap-2 px-1 py-0.5">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <ChevronDown
                            className={cn(
                              "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                              expanded && "rotate-180",
                            )}
                            aria-hidden
                          />
                          <p className="truncate text-sm font-medium text-foreground">
                            {row.label}
                          </p>
                        </div>
                        <p className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                          {formatInr(row.amount)} · {row.orders} PO
                          {row.orders === 1 ? "" : "s"}
                        </p>
                      </div>
                    </button>
                    {expanded ? (
                      <ul className="mt-2 space-y-1 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2">
                        {row.pos.map((po) => (
                          <li
                            key={po.id}
                            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2"
                          >
                            <Link
                              href={`/procurement/orders/${po.id}`}
                              className="cursor-pointer truncate font-mono text-xs font-medium text-foreground transition-colors duration-200 hover:text-[#0369A1] hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {po.companyPo}
                            </Link>
                            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                              {formatInr(po.amount)}
                            </span>
                            <Badge
                              variant={VENDOR_PO_STATUS_BADGE[po.fulfillment]}
                              className="justify-self-end uppercase"
                            >
                              {VENDOR_PO_STATUS_LABEL[po.fulfillment]}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Boxes className="size-3.5 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Inventory mix
            </h2>
          </div>
          {loading || !stockSummary ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : stockSummary.byProduct.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No GRN stock on hand.
            </p>
          ) : (
            <div className={procurementUi.tableShell}>
              <div className={procurementUi.tableScroll}>
                <table className={cn(procurementUi.table, "min-w-[280px]")}>
                  <thead className={procurementUi.thead}>
                    <tr>
                      <th className={cn(procurementUi.th, "px-3")}>Product</th>
                      <th className={cn(procurementUi.th, "px-3 text-right")}>Units</th>
                      <th className={cn(procurementUi.th, "px-3 text-right")}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockSummary.byProduct.slice(0, 8).map((row) => (
                      <tr key={row.productName} className={procurementUi.tr}>
                        <td className={cn(procurementUi.td, "px-3 font-medium")}>
                          {row.productName}
                        </td>
                        <td
                          className={cn(
                            procurementUi.tdNumeric,
                            "px-3 text-right font-mono",
                          )}
                        >
                          {row.units.toLocaleString("en-IN")}
                        </td>
                        <td
                          className={cn(
                            procurementUi.tdNumeric,
                            "px-3 text-right font-mono",
                          )}
                        >
                          {formatInr(row.stockValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <Link
            href="/procurement/inventory"
            className="mt-3 inline-flex cursor-pointer text-xs font-medium text-[#0369A1] transition-colors duration-200 hover:underline"
          >
            Open Inventory
          </Link>
        </section>
      </div>

      <section className="rounded-xl border border-sky-200/80 bg-sky-50/50 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-sky-200/70 bg-sky-100 text-sky-800">
              <BarChart3 className="size-3.5" aria-hidden />
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-tight text-sky-900">
              Vendor spend histogram
            </h2>
          </div>
          <p className="shrink-0 font-mono text-xs tabular-nums text-sky-800/80">
            {loading ? "—" : `${vendorSpend.length.toLocaleString("en-IN")} vendors`}
          </p>
        </div>
        {loading ? (
          <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : vendorHistogram.length === 0 ? (
          <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            No issued purchase orders yet.
          </p>
        ) : (
          <div
            className="h-[280px] w-full"
            role="img"
            aria-label="Histogram of top vendors by purchase order value"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={vendorHistogram}
                margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="4 4" stroke="#BAE6FD" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#334155", fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(value: number) => {
                    if (value >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(1)}Cr`;
                    if (value >= 1_00_000) return `${(value / 1_00_000).toFixed(1)}L`;
                    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
                    return String(value);
                  }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(3, 105, 161, 0.06)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as
                      | (typeof vendorHistogram)[number]
                      | undefined;
                    if (!row) return null;
                    return (
                      <div className="rounded-lg border border-sky-200/80 bg-card px-3 py-2 text-xs shadow-md">
                        <p className="font-medium text-foreground">{row.fullName}</p>
                        <p className="mt-1 tabular-nums text-sky-800">
                          {formatInr(row.amount)}
                        </p>
                        <p className="tabular-nums text-muted-foreground">
                          {row.orders.toLocaleString("en-IN")} PO
                          {row.orders === 1 ? "" : "s"}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="amount"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                  className="cursor-pointer"
                  onClick={(data) => {
                    const vendorId = (data as { vendorId?: string } | undefined)?.vendorId;
                    if (!vendorId) return;
                    setExpandedVendorId((prev) => (prev === vendorId ? null : vendorId));
                  }}
                >
                  {vendorHistogram.map((row, index) => (
                    <Cell
                      key={row.vendorId}
                      fill={VENDOR_BAR_COLORS[index % VENDOR_BAR_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </ProcurementPage>
  );
}
