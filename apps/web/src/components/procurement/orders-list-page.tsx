"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CircleDot,
  FileDown,
  FileSpreadsheet,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  formatInr,
  getPurchaseOrder,
  listPurchaseOrders,
  listVendorOptions,
  invalidateProcurementListCache,
  type ProcOrder,
} from "@/services/procurement-service";
import {
  buildOrderExportRows,
  exportOrdersXlsx,
} from "@/utils/orders-excel-export";
import {
  formatGrnStatusBadgeLabel,
  grnStatusMatchesSearch,
} from "@/utils/grn-status-display";
import { downloadOrderPdf } from "@/utils/purchase-order-pdf";

type StatusFilter =
  | "all"
  | "draft"
  | "open"
  | "issued"
  | "delivered"
  | "cancelled"
  | "grn_pending"
  | "grn_partial"
  | "grn_closed";

const CLOSED_STATUSES = new Set([
  "draft",
  "received",
  "delivered",
  "closed",
  "cancelled",
  "completed",
]);

const DELIVERED_STATUSES = new Set(["received", "delivered", "closed"]);

function parseStatusFilter(value: string | null): StatusFilter {
  const allowed: StatusFilter[] = [
    "all",
    "draft",
    "open",
    "issued",
    "delivered",
    "cancelled",
    "grn_pending",
    "grn_partial",
    "grn_closed",
  ];
  if (value && (allowed as string[]).includes(value)) return value as StatusFilter;
  return "all";
}

function deriveGrnStatus(order: ProcOrder): "pending" | "partial" | "closed" {
  const lines = order.lines || [];
  if (lines.length === 0) return "pending";
  const badges = new Set<"pending" | "partial" | "delivered">();
  for (const ln of lines) {
    const qty = Number(ln.quantity) || 0;
    const recv = Number(ln.quantity_received) || 0;
    const lineStatus = (ln.status || "").toLowerCase();
    if (lineStatus === "received" || lineStatus === "closed" || (qty > 0 && recv >= qty)) {
      badges.add("delivered");
    } else if (recv > 0) {
      badges.add("partial");
    } else {
      badges.add("pending");
    }
  }
  if (badges.size === 1 && badges.has("delivered")) return "closed";
  if (badges.has("partial") || badges.has("delivered")) return "partial";
  return "pending";
}

function grnTone(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "closed" || status === "delivered") return "default";
  if (status === "partial") return "secondary";
  return "outline";
}

function isDraft(status: string): boolean {
  return status.toLowerCase() === "draft";
}

function isCancelled(status: string): boolean {
  return status.toLowerCase() === "cancelled";
}

function isIssued(status: string): boolean {
  const value = status.toLowerCase();
  return value !== "draft" && value !== "cancelled";
}

function isOpenPo(status: string): boolean {
  const value = status.toLowerCase();
  return Boolean(value) && !CLOSED_STATUSES.has(value);
}

function isDeliveredPo(status: string): boolean {
  return DELIVERED_STATUSES.has(status.toLowerCase());
}

export function OrdersListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusFilter = parseStatusFilter(searchParams.get("filter"));

  const [rows, setRows] = useState<ProcOrder[]>([]);
  const [vendors, setVendors] = useState<Record<string, { label: string; address: string }>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setStatusFilter = useCallback(
    (next: StatusFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") params.delete("filter");
      else params.set("filter", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const load = useCallback(async (force = false) => {
    if (force) invalidateProcurementListCache();
    setLoading(true);
    setError(null);
    void listVendorOptions()
      .then((vendorRows) => {
        setVendors(
          Object.fromEntries(
            vendorRows.map((v) => [v.id, { label: v.label, address: v.address }]),
          ),
        );
      })
      .catch(() => {
        /* vendor labels are optional for the table */
      });
    try {
      const orders = await listPurchaseOrders();
      setRows(orders);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enriched = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        grn_status: deriveGrnStatus(row),
      })),
    [rows],
  );

  const kpis = useMemo(() => {
    return {
      total: enriched.length,
      draft: enriched.filter((row) => isDraft(row.status)).length,
      open: enriched.filter((row) => isOpenPo(row.status)).length,
      issued: enriched.filter((row) => isIssued(row.status)).length,
      delivered: enriched.filter((row) => isDeliveredPo(row.status)).length,
      grnPending: enriched.filter((row) => row.grn_status === "pending").length,
      grnPartial: enriched.filter((row) => row.grn_status === "partial").length,
      grnClosed: enriched.filter((row) => row.grn_status === "closed").length,
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    switch (statusFilter) {
      case "draft":
        list = list.filter((row) => isDraft(row.status));
        break;
      case "open":
        list = list.filter((row) => isOpenPo(row.status));
        break;
      case "issued":
        list = list.filter((row) => isIssued(row.status));
        break;
      case "delivered":
        list = list.filter((row) => isDeliveredPo(row.status));
        break;
      case "cancelled":
        list = list.filter((row) => isCancelled(row.status));
        break;
      case "grn_pending":
        list = list.filter((row) => row.grn_status === "pending");
        break;
      case "grn_partial":
        list = list.filter((row) => row.grn_status === "partial");
        break;
      case "grn_closed":
        list = list.filter((row) => row.grn_status === "closed");
        break;
      default:
        break;
    }

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) => {
      const vendor = vendors[row.vendor_id]?.label || "";
      return (
        (row.company_po_number || "").toLowerCase().includes(q) ||
        (row.customer_name || "").toLowerCase().includes(q) ||
        row.document_number.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q) ||
        grnStatusMatchesSearch(row.grn_status, q) ||
        vendor.toLowerCase().includes(q)
      );
    });
  }, [enriched, statusFilter, query, vendors]);

  async function onExport() {
    setError(null);
    if (enriched.length === 0) {
      setError("No purchase orders available to export.");
      return;
    }
    setExportBusy(true);
    try {
      const commercial = await listPurchaseOrders({ includeCommercial: true });
      const idSet = new Set(enriched.map((row) => row.id));
      const source = commercial.filter((row) => idSet.has(row.id));
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const exportRows = buildOrderExportRows(source, vendors);
      await exportOrdersXlsx(`purchase-orders-all-${stamp}.xlsx`, exportRows);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to export purchase orders");
    } finally {
      setExportBusy(false);
    }
  }

  async function onDownloadPdf(orderId: string) {
    setPdfBusyId(orderId);
    setError(null);
    try {
      const order = await getPurchaseOrder(orderId);
      const vendor = vendors[order.vendor_id];
      await downloadOrderPdf(order, {
        name: vendor?.label || order.vendor_id,
        address: vendor?.address || "",
      });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to download PO PDF");
    } finally {
      setPdfBusyId(null);
    }
  }

  const filterChips: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "open", label: "Open" },
    { key: "issued", label: "Issued" },
    { key: "delivered", label: "Delivered" },
    { key: "grn_pending", label: "GRN open" },
    { key: "grn_partial", label: "GRN partial" },
    { key: "grn_closed", label: "GRN closed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className={procurementUi.page}>
      <ProcurementPageHeader
        title="Purchase Orders"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading || exportBusy}
              onClick={() => void onExport()}
            >
              <FileSpreadsheet className="mr-1.5 size-3.5 text-[#0369A1]" />
              {exportBusy ? "Exporting…" : "Export to Excel"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load(true)}
              disabled={loading}
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceKpiCard
          label="All POs"
          value={String(kpis.total)}
          icon={ShoppingCart}
          href="/procurement/orders"
        />
        <FinanceKpiCard
          label="Draft"
          value={String(kpis.draft)}
          tone="warning"
          icon={CircleDot}
          href="/procurement/orders?filter=draft"
        />
        <FinanceKpiCard
          label="Open"
          value={String(kpis.open)}
          icon={ShoppingCart}
          href="/procurement/orders?filter=open"
        />
        <FinanceKpiCard
          label="Delivered"
          value={String(kpis.delivered)}
          tone="success"
          icon={PackageCheck}
          href="/procurement/orders?filter=delivered"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filterChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setStatusFilter(chip.key)}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-200",
              statusFilter === chip.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className={procurementUi.tableShell}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {filtered.length} orders
          </p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            className={procurementUi.searchInput}
          />
        </div>
        <div className={procurementUi.tableScroll}>
          <table className={cn(procurementUi.table, "min-w-[1080px]")}>
            <thead className={procurementUi.thead}>
              <tr>
                <th className="px-3 py-2 font-medium">S.No</th>
                <th className="px-3 py-2 font-medium">Company PO number</th>
                <th className="px-3 py-2 font-medium">PO date</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">GRN</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 text-center font-medium">PDF</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    Loading purchase orders…
                  </td>
                </tr>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    No purchase orders match this filter.
                  </td>
                </tr>
              ) : null}
              {filtered.map((row, index) => {
                const orderHref = `/procurement/orders/${row.id}`;
                return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border/70 cursor-pointer transition-colors duration-150",
                    "hover:bg-muted/40 active:bg-muted/55",
                  )}
                  onClick={() => router.push(orderHref)}
                >
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">
                    {row.company_po_number || row.document_number || "—"}
                  </td>
                  <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                    {row.document_date || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {vendors[row.vendor_id]?.label || row.vendor_id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2">{row.customer_name || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{formatInr(row.total_amount)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={grnTone(row.grn_status)} className="uppercase">
                      {formatGrnStatusBadgeLabel(row.grn_status)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={orderHref}
                      className={cn(
                        buttonVariants({
                          size: "sm",
                          variant: isDraft(row.status) ? "default" : "outline",
                        }),
                        "cursor-pointer transition-colors duration-200",
                      )}
                      title={
                        isDraft(row.status)
                          ? "Open draft to review, then finalize & issue inside"
                          : "Open purchase order"
                      }
                    >
                      {isDraft(row.status) ? "Review draft" : "Open"}
                    </Link>
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 cursor-pointer border-border p-0 text-[#0369A1] transition-colors duration-200 hover:bg-sky-50 hover:text-[#0369A1]"
                        disabled={pdfBusyId === row.id || isDraft(row.status)}
                        title={
                          isDraft(row.status)
                            ? "Finalize the PO before downloading PDF"
                            : "Download PO PDF"
                        }
                        aria-label={`Download PDF for ${row.document_number}`}
                        onClick={() => void onDownloadPdf(row.id)}
                      >
                        <FileDown className="size-4 stroke-[2]" />
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
