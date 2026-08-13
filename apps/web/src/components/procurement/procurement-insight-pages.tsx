"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Download,
  FileBarChart,
  FileSpreadsheet,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  Truck,
} from "lucide-react";
import * as XLSX from "xlsx";

import { Exploded3dPieChart, type Exploded3dPieSlice } from "@/components/procurement/exploded-3d-pie";
import { ProcurementPipelineFunnel } from "@/components/procurement/procurement-pipeline-funnel";
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
import { buildGrnExportRows, exportGrnsXlsx } from "@/utils/grns-excel-export";
import { buildOrderExportRows, exportOrdersXlsx } from "@/utils/orders-excel-export";
import {
  buildProcurementInventoryStockSummary,
  isGrnNonBilledStockRow,
} from "@/utils/procurement-inventory-report";
import { buildProcurementPipelineMetrics } from "@/utils/procurement-pipeline-metrics";
import {
  buildPoGrnBillingRows,
  poGrnBillingExportRows,
} from "@/utils/procurement-po-grn-billing";
import { countPoBuckets, emptyPoBucketCounts, poOverviewBucketForOrder } from "@/utils/procurement-po-buckets";
import { textTokenMatch } from "@/utils/procurement-search";
import { isScmOpenOvfRow } from "@/utils/scm-queue-ovf-status";

function stampNow(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function downloadSheet(
  filename: string,
  rows: Record<string, string | number>[],
  sheetName: string,
) {
  const data =
    rows.length > 0
      ? rows
      : [{ Note: "No rows available for this export." }];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
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

type ReportCard = {
  id: string;
  title: string;
  description: string;
  icon: typeof FileSpreadsheet;
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
    () => (data?.inventory ?? []).filter(isGrnNonBilledStockRow),
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
    const tokens = statusQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return poStatusRows;
    return poStatusRows.filter((row) =>
      tokens.every(
        (token) =>
          textTokenMatch(row.companyPo, token) ||
          textTokenMatch(row.vendor, token) ||
          textTokenMatch(row.poStatus, token) ||
          textTokenMatch(row.grnStatus, token) ||
          row.grnNumbers.some((grn) => textTokenMatch(grn, token)),
      ),
    );
  }, [poStatusRows, statusQuery]);

  const grnStatusSlices = useMemo((): Exploded3dPieSlice[] => {
    const counts = { pending: 0, partial: 0, closed: 0 };
    for (const row of poStatusRows) {
      const key = row.grnStatusKey;
      if (key === "partial") counts.partial += 1;
      else if (key === "closed" || key === "delivered") counts.closed += 1;
      else counts.pending += 1;
    }
    return [
      {
        key: "pending",
        label: "GRN open",
        value: counts.pending,
        color: "#0369A1",
        href: "/procurement/grns?filter=all",
      },
      {
        key: "partial",
        label: "GRN partial",
        value: counts.partial,
        color: "#C2410C",
        href: "/procurement/grns?filter=partial",
      },
      {
        key: "closed",
        label: "GRN delivered",
        value: counts.closed,
        color: "#0F766E",
        href: "/procurement/grns?filter=closed",
      },
    ].filter((s) => s.value > 0);
  }, [poStatusRows]);

  const grnDocSlices = useMemo((): Exploded3dPieSlice[] => {
    let awaiting = 0;
    let single = 0;
    let multi = 0;
    for (const row of poStatusRows) {
      if (row.grnDocuments <= 0) awaiting += 1;
      else if (row.grnDocuments === 1) single += 1;
      else multi += 1;
    }
    return [
      { key: "awaiting", label: "No GRN yet", value: awaiting, color: "#94A3B8" },
      { key: "single", label: "1 GRN", value: single, color: "#0284C7" },
      { key: "multi", label: "2+ GRNs", value: multi, color: "#0D9488" },
    ].filter((s) => s.value > 0);
  }, [poStatusRows]);

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

  function grnTone(statusKey: string): "default" | "secondary" | "outline" {
    if (statusKey === "closed" || statusKey === "delivered") return "default";
    if (statusKey === "partial") return "secondary";
    return "outline";
  }

  const cards: ReportCard[] = [
    {
      id: "orders-all",
      title: "Purchase orders",
      description: "Full commercial PO workbook — vendor, customer, margin, status.",
      icon: ShoppingCart,
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
      id: "grns",
      title: "GRN receipt status",
      description: "Vendor PO receipt status with line-level ordered vs received.",
      icon: PackageCheck,
      href: "/procurement/grns",
      countLabel: loading ? "…" : `${issuedPos.length.toLocaleString("en-IN")} issued POs`,
      onExport: async () => {
        if (!data) return;
        const rows = buildGrnExportRows(issuedPos, data.vendors);
        exportGrnsXlsx(`grn-receipt-status-${stampNow()}.xlsx`, rows);
      },
    },
    {
      id: "inventory",
      title: "Inventory on hand",
      description: "Non-billed GRN stock units — product, serial, PO, GRN, unit cost.",
      icon: Boxes,
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
      id: "scm-queue",
      title: "SCM queue",
      description: "OVF queue snapshot — customer, vendor, PO link, hold state.",
      icon: ClipboardList,
      href: "/procurement/scm",
      countLabel: loading
        ? "…"
        : `${(data?.scmQueue.length ?? 0).toLocaleString("en-IN")} OVFs`,
      onExport: async () => {
        if (!data) return;
        const rows = data.scmQueue.map((row, index) => ({
          "#": index + 1,
          "OVF no": row.ovf_no,
          Customer: row.customer_name || row.account_name || "",
          Vendor: row.vendor_name || row.oem_name || "",
          "Customer PO": row.po_number || "",
          "Company PO": row.company_po_number || row.purchase_order_number || "",
          "PO status": row.purchase_order_status || "",
          "On hold": row.scm_on_hold ? "Yes" : "No",
          "Vendor total": Number(row.vendor_total) || 0,
          Margin: Number(row.margin_amount) || 0,
        }));
        downloadSheet(`scm-queue-${stampNow()}.xlsx`, rows, "SCM Queue");
      },
    },
    {
      id: "vendor-spend",
      title: "Vendor spend summary",
      description: "Aggregated PO value by vendor for issued purchase orders.",
      icon: Truck,
      href: "/procurement/vendors",
      countLabel: loading
        ? "…"
        : `${Object.keys(data?.vendors ?? {}).length.toLocaleString("en-IN")} vendors`,
      onExport: async () => {
        if (!data) return;
        const spend = new Map<
          string,
          { vendor: string; orders: number; amount: number }
        >();
        for (const order of data.orders) {
          const status = (order.status || "").toLowerCase();
          if (status === "draft" || status === "cancelled") continue;
          const vendor =
            data.vendors[order.vendor_id]?.label || order.vendor_id || "Unknown";
          const entry = spend.get(order.vendor_id) ?? {
            vendor,
            orders: 0,
            amount: 0,
          };
          entry.orders += 1;
          entry.amount += Number(order.vendor_total) || Number(order.total_amount) || 0;
          spend.set(order.vendor_id, entry);
        }
        const rows = Array.from(spend.values())
          .sort((a, b) => b.amount - a.amount)
          .map((row, index) => ({
            "#": index + 1,
            Vendor: row.vendor,
            "PO count": row.orders,
            "Total amount": Math.round(row.amount * 100) / 100,
          }));
        downloadSheet(`vendor-spend-${stampNow()}.xlsx`, rows, "Vendor spend");
      },
    },
  ];

  return (
    <ProcurementPage>
      <ProcurementPageHeader
        title="Reports"
        description="On-demand Excel exports for procurement operations."
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
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              PO → GRN → billing status
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Input
              type="search"
              value={statusQuery}
              onChange={(e) => setStatusQuery(e.target.value)}
              placeholder="Search PO, vendor, status…"
              aria-label="Search PO GRN billing status"
              className={cn(procurementUi.searchInput, "w-[220px] shrink-0")}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading || busyId === "po-grn-billing" || filteredPoStatusRows.length === 0}
              onClick={() =>
                void runExport("po-grn-billing", async () => {
                  downloadSheet(
                    `po-grn-billing-status-${stampNow()}.xlsx`,
                    poGrnBillingExportRows(filteredPoStatusRows),
                    "PO GRN billing",
                  );
                })
              }
            >
              <Download className="mr-1.5 size-3.5" />
              {busyId === "po-grn-billing" ? "Exporting…" : "Export"}
            </Button>
          </div>
        </div>

        <div className={procurementUi.tableShell}>
          <div className={procurementUi.tableScroll}>
            <table className={cn(procurementUi.table, "min-w-[1080px]")}>
              <thead className={procurementUi.thead}>
                <tr>
                  <th className={cn(procurementUi.th, "px-3")}>Company PO</th>
                  <th className={cn(procurementUi.th, "px-3")}>Vendor</th>
                  <th className={cn(procurementUi.th, "px-3")}>PO status</th>
                  <th className={cn(procurementUi.th, "px-3")}>GRN status</th>
                  <th className={cn(procurementUi.th, "px-3 text-right")}>GRNs</th>
                  <th className={cn(procurementUi.th, "px-3 text-right")}>Ordered</th>
                  <th className={cn(procurementUi.th, "px-3 text-right")}>Received</th>
                  <th className={cn(procurementUi.th, "px-3 text-right")}>Billed</th>
                  <th className={cn(procurementUi.th, "px-3 text-right")}>Unbilled</th>
                  <th className={cn(procurementUi.th, "px-3 text-right")}>Recv %</th>
                  <th className={cn(procurementUi.th, "px-3")}>GRN numbers</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className={procurementUi.empty}>
                      Loading PO status…
                    </td>
                  </tr>
                ) : filteredPoStatusRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className={procurementUi.empty}>
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
                      <td className={cn(procurementUi.td, "px-3")}>{row.poStatus}</td>
                      <td className={cn(procurementUi.td, "px-3")}>
                        <Badge variant={grnTone(row.grnStatusKey)} className="uppercase">
                          {row.grnStatus}
                        </Badge>
                      </td>
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
                        {row.qtyBilled.toLocaleString("en-IN")}
                      </td>
                      <td className={cn(procurementUi.tdNumeric, "px-3 text-right font-mono")}>
                        {row.qtyUnbilled.toLocaleString("en-IN")}
                      </td>
                      <td className={cn(procurementUi.tdNumeric, "px-3 text-right font-mono")}>
                        {row.receiptPct}%
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

      <div className="grid items-stretch gap-4 lg:grid-cols-2 lg:gap-5">
        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">
            GRN status mix
          </h2>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : grnStatusSlices.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No GRN data yet</p>
          ) : (
            <div className="rounded-xl border border-border/50 bg-gradient-to-b from-slate-50/90 to-white px-2.5 py-3">
              <Exploded3dPieChart
                slices={grnStatusSlices}
                ariaLabel="GRN status mix by purchase order"
                size={156}
                layout="horizontal"
                legendMode="count"
              />
            </div>
          )}
        </section>
        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">
            GRNs per purchase order
          </h2>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : grnDocSlices.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No GRN data yet</p>
          ) : (
            <div className="rounded-xl border border-border/50 bg-gradient-to-b from-slate-50/90 to-white px-2.5 py-3">
              <Exploded3dPieChart
                slices={grnDocSlices}
                ariaLabel="How many GRN documents each PO has"
                size={156}
                layout="horizontal"
                legendMode="count"
              />
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const busy = busyId === card.id;
          return (
            <div
              key={card.id}
              className="flex h-full flex-col rounded-xl border border-border/80 bg-card p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-foreground">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    {card.title}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {card.countLabel}
              </p>
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

function AnalyticsStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-3.5 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ProcurementAnalyticsPage() {
  const { data, loading, refreshing, error, reload } = useProcurementInsightData();

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
      data.inventory.filter(isGrnNonBilledStockRow),
      { vendorLabels: labels },
    );
  }, [data]);

  const openOvf = useMemo(
    () => (data?.scmQueue ?? []).filter(isScmOpenOvfRow).length,
    [data],
  );

  const vendorSpend = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { label: string; amount: number; orders: number }>();
    for (const order of data.orders) {
      const status = (order.status || "").toLowerCase();
      if (status === "draft" || status === "cancelled") continue;
      const label = data.vendors[order.vendor_id]?.label || order.vendor_id;
      const entry = map.get(order.vendor_id) ?? { label, amount: 0, orders: 0 };
      entry.amount += Number(order.vendor_total) || Number(order.total_amount) || 0;
      entry.orders += 1;
      map.set(order.vendor_id, entry);
    }
    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [data]);

  const maxSpend = Math.max(...vendorSpend.map((row) => row.amount), 1);

  return (
    <ProcurementPage>
      <ProcurementPageHeader
        title="Analytics"
        description="Live procurement KPIs, receipt progress, and vendor spend."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/procurement/reports"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "cursor-pointer transition-colors duration-200",
              )}
            >
              <FileBarChart className="mr-1.5 size-3.5" />
              Reports & exports
            </Link>
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
          hint="SCM queue awaiting PO"
        />
        <AnalyticsStat
          label="Open PO"
          value={loading ? "—" : buckets.open.toLocaleString("en-IN")}
          hint={`${buckets.partial.toLocaleString("en-IN")} partial`}
        />
        <AnalyticsStat
          label="GRN documents"
          value={loading ? "—" : pipelineMetrics.grns.toLocaleString("en-IN")}
          hint={`${pipelineMetrics.posWithGrn.toLocaleString("en-IN")} POs with GRN`}
        />
        <AnalyticsStat
          label="Stock value"
          value={loading || !stockSummary ? "—" : formatInr(stockSummary.totalStockValue)}
          hint={
            stockSummary
              ? `${stockSummary.totalUnits.toLocaleString("en-IN")} units on hand`
              : undefined
          }
        />
      </div>

      <ProcurementPipelineFunnel metrics={pipelineMetrics} loading={loading} />

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
                const width = Math.round((row.amount / maxSpend) * 100);
                return (
                  <li key={row.label} className="min-w-0">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{row.label}</p>
                      <p className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {formatInr(row.amount)} · {row.orders} PO
                        {row.orders === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[#0369A1] transition-[width] duration-300"
                        style={{ width: `${width}%` }}
                        role="presentation"
                      />
                    </div>
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
            Open inventory
          </Link>
        </section>
      </div>
    </ProcurementPage>
  );
}
