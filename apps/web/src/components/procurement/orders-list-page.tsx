"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FileSpreadsheet,
  PackageCheck,
  PackageOpen,
  Plus,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  ProcurementErrorBanner,
  ProcurementKpiCard,
  ProcurementListPanel,
  ProcurementPage,
  procurementUi,
} from "@/components/procurement/procurement-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  formatInr,
  listPurchaseOrders,
  listVendorOptions,
  invalidateProcurementListCache,
  peekPurchaseOrdersFromCache,
  type ProcOrder,
} from "@/services/procurement-service";
import {
  buildOrderExportRows,
  exportOrdersXlsx,
} from "@/utils/orders-excel-export";
import {
  formatGrnStatusBadgeLabel,
  grnBadgeVariant,
  grnStatusMatchesSearch,
} from "@/utils/grn-status-display";
import { textTokenMatch } from "@/utils/procurement-search";
import { deriveGrnStatus, filterOrdersByPoBucket, parsePoOverviewBucket, countPoBuckets, poOverviewBucketForOrder } from "@/utils/procurement-po-buckets";

type StatusFilter = "all" | "draft" | "open" | "partial" | "closed" | "cancelled";

function formatPoStatusLabel(status: string | null | undefined): string {
  const raw = (status || "").trim().toLowerCase();
  if (!raw) return "—";
  if (raw === "draft") return "Draft";
  if (raw === "cancelled" || raw === "canceled") return "Cancelled";
  if (
    raw === "issued" ||
    raw === "approved" ||
    raw === "open" ||
    raw === "sent" ||
    raw === "submitted"
  ) {
    return "Approved";
  }
  if (raw === "partial" || raw === "partially_received") return "Partial";
  if (raw === "closed" || raw === "received" || raw === "completed") return "Closed";
  return raw
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseStatusFilter(value: string | null): StatusFilter {
  const allowed: StatusFilter[] = [
    "all",
    "draft",
    "open",
    "partial",
    "closed",
    "cancelled",
  ];
  if (value && (allowed as string[]).includes(value)) return value as StatusFilter;
  return "all";
}

function isDraft(status: string): boolean {
  return status.toLowerCase() === "draft";
}

function isCancelled(status: string): boolean {
  return status.toLowerCase() === "cancelled";
}

/** Match list filter — numeric tokens prefer company PO sequence (005 → PO/CDT/005). */
function orderMatchesQuery(
  row: ProcOrder,
  vendorLabel: string,
  rawQuery: string,
): boolean {
  const tokens = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const companyPo = (row.company_po_number || "").trim().toLowerCase();
  const docNo = (row.document_number || "").trim().toLowerCase();
  const customer = (row.customer_name || "").trim().toLowerCase();
  const approved = (row.approved_by_name || "").trim().toLowerCase();
  const vendor = vendorLabel.trim().toLowerCase();
  const companyPoDigits = companyPo.replace(/\D/g, "");

  return tokens.every((token) => {
    if (/^\d+$/.test(token)) {
      if (companyPo.includes(token)) return true;
      if (companyPoDigits.includes(token) || companyPoDigits.endsWith(token)) return true;
      // Only fall back to system document number when there is no company PO.
      if (!companyPo) {
        const docDigits = docNo.replace(/\D/g, "");
        return docNo.includes(token) || docDigits.endsWith(token);
      }
      return false;
    }
    return (
      textTokenMatch(companyPo, token) ||
      textTokenMatch(docNo, token) ||
      textTokenMatch(customer, token) ||
      textTokenMatch(approved, token) ||
      textTokenMatch(vendor, token) ||
      textTokenMatch(row.status, token) ||
      grnStatusMatchesSearch(row.grn_status ?? "pending", token)
    );
  });
}

export function OrdersListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusFilter = parseStatusFilter(searchParams.get("filter"));
  const bucketFilter = (() => {
    const raw = searchParams.get("bucket");
    if (!raw) return null;
    return parsePoOverviewBucket(raw);
  })();

  const cachedOrdersOnMount = peekPurchaseOrdersFromCache();
  const [rows, setRows] = useState<ProcOrder[]>(() => cachedOrdersOnMount ?? []);
  const [vendors, setVendors] = useState<Record<string, { label: string; address: string }>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(() => cachedOrdersOnMount === null);
  const [refreshing, setRefreshing] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setStatusFilter = useCallback(
    (next: StatusFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("bucket");
      if (next === "all") params.delete("filter");
      else params.set("filter", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const load = useCallback(async (force = false) => {
    if (force) invalidateProcurementListCache();
    const hadInstant = !force && peekPurchaseOrdersFromCache() !== null;
    if (!hadInstant) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
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
      if (!hadInstant) {
        setRows([]);
      }
      setError(formatApiError(err, "Failed to load purchase orders"));
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    const buckets = countPoBuckets(enriched);
    return {
      total: enriched.length,
      open: buckets.open,
      partial: buckets.partial,
      closed: buckets.close,
      draft: buckets.draft,
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (bucketFilter) {
      list = filterOrdersByPoBucket(list, bucketFilter);
    } else {
      switch (statusFilter) {
        case "draft":
          list = list.filter((row) => isDraft(row.status));
          break;
        case "open":
          list = list.filter(
            (row) => poOverviewBucketForOrder(row, row.grn_status) === "open",
          );
          break;
        case "partial":
          list = list.filter(
            (row) => poOverviewBucketForOrder(row, row.grn_status) === "partial",
          );
          break;
        case "closed":
          list = list.filter(
            (row) => poOverviewBucketForOrder(row, row.grn_status) === "close",
          );
          break;
        case "cancelled":
          list = list.filter((row) => isCancelled(row.status));
          break;
        default:
          break;
      }
    }

    const q = query.trim();
    if (!q) return list;
    return list.filter((row) =>
      orderMatchesQuery(row, vendors[row.vendor_id]?.label || "", q),
    );
  }, [enriched, statusFilter, bucketFilter, query, vendors]);

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
      setError(formatApiError(err, "Failed to export purchase orders"));
    } finally {
      setExportBusy(false);
    }
  }

  const filterChips: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "open", label: "Open" },
    { key: "partial", label: "Partial" },
    { key: "closed", label: "Closed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <ProcurementPage>
      <PageHeader
        title="Purchase Orders"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading}
              onClick={() => router.push("/procurement/orders/create")}
            >
              <Plus className="mr-1.5 size-3.5" />
              Create purchase order
            </Button>
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
              disabled={loading && rows.length === 0}
            >
              <RefreshCw
                className={cn(
                  "mr-1.5 size-3.5",
                  (loading || refreshing) && "animate-spin",
                )}
              />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <ProcurementKpiCard
          label="ALL POs"
          value={String(kpis.total)}
          icon={ShoppingCart}
          href="/procurement/orders"
        />
        <ProcurementKpiCard
          label="PARTIAL PO"
          value={String(kpis.partial)}
          tone="warning"
          icon={PackageOpen}
          href="/procurement/orders?bucket=partial"
        />
        <ProcurementKpiCard
          label="OPEN PO"
          value={String(kpis.open)}
          icon={ShoppingCart}
          href="/procurement/orders?bucket=open"
        />
        <ProcurementKpiCard
          label="CLOSE PO"
          value={String(kpis.closed)}
          tone="success"
          icon={PackageCheck}
          href="/procurement/orders?bucket=close"
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

      {error ? <ProcurementErrorBanner>{error}</ProcurementErrorBanner> : null}

      <ProcurementListPanel>
        <div className="flex flex-wrap items-center justify-end gap-3 border-b border-border/80 px-3 py-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="PO number, vendor, customer…"
            className={procurementUi.searchInput}
            aria-label="Search purchase orders"
          />
        </div>
        <div className={procurementUi.tableScroll}>
          <table className={cn(procurementUi.table, "min-w-[1080px] leading-normal")}>
            <thead className={procurementUi.thead}>
              <tr>
                <th className="px-3 py-3.5 font-bold">S.No</th>
                <th className="px-3 py-3.5 font-bold">Company PO number</th>
                <th className="px-3 py-3.5 font-bold">PO date</th>
                <th className="px-3 py-3.5 font-bold">Vendor</th>
                <th className="px-3 py-3.5 font-bold">Status</th>
                <th className="px-3 py-3.5 font-bold">Amount</th>
                <th className="px-3 py-3.5 font-bold">GRN</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    Loading purchase orders…
                  </td>
                </tr>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
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
                    "border-b border-border/70 cursor-pointer transition-colors duration-200",
                    "hover:bg-sky-50 active:bg-sky-100/80",
                  )}
                  onClick={() => router.push(orderHref)}
                >
                  <td className="px-3 py-3.5 tabular-nums text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-3.5 font-medium tabular-nums">
                    {row.company_po_number || row.document_number || "—"}
                  </td>
                  <td className={cn(procurementUi.tdNumeric, "py-3.5 text-muted-foreground")}>
                    {row.document_date || "—"}
                  </td>
                  <td className="px-3 py-3.5">
                    {vendors[row.vendor_id]?.label || row.vendor_id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-3.5">{formatPoStatusLabel(row.status)}</td>
                  <td className="px-3 py-3.5 tabular-nums">{formatInr(row.total_amount)}</td>
                  <td className="px-3 py-3.5">
                    <Badge variant={grnBadgeVariant(row.grn_status ?? "pending")} className="uppercase">
                      {formatGrnStatusBadgeLabel(row.grn_status ?? "pending")}
                    </Badge>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ProcurementListPanel>
    </ProcurementPage>
  );
}
