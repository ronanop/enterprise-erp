"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileSpreadsheet, RefreshCw } from "lucide-react";

import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  formatInr,
  invalidateProcurementListCache,
  listPurchaseOrders,
  listVendorOptions,
  peekPurchaseOrdersFromCache,
  type ProcOrder,
} from "@/services/procurement-service";
import { buildOrderExportRows, exportOrdersXlsx } from "@/utils/orders-excel-export";
import { formatGrnStatusBadgeLabel, grnBadgeVariant } from "@/utils/grn-status-display";
import {
  countPoBuckets,
  deriveGrnStatus,
  emptyPoBucketCounts,
  filterOrdersByPoBucket,
  parsePoOverviewBucket,
  PO_OVERVIEW_BUCKET_LABELS,
  type PoOverviewBucket,
} from "@/utils/procurement-po-buckets";
import { textTokenMatch } from "@/utils/procurement-search";

const BUCKETS: PoOverviewBucket[] = ["open", "partial", "close", "draft"];

function orderCustomerOrApproverLabel(order: ProcOrder): string {
  const customer = (order.customer_name || "").trim();
  if (customer) return customer;
  return (order.approved_by_name || "").trim();
}

export function OrdersOverviewPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bucket = parsePoOverviewBucket(searchParams.get("bucket"));

  const cachedOnMount = peekPurchaseOrdersFromCache();
  const [rows, setRows] = useState<ProcOrder[]>(() => cachedOnMount ?? []);
  const [vendors, setVendors] = useState<Record<string, { label: string }>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(() => cachedOnMount === null);
  const [refreshing, setRefreshing] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setBucket = useCallback(
    (next: PoOverviewBucket) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("bucket", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const load = useCallback(async (force = false) => {
    if (force) invalidateProcurementListCache();
    const hadInstant = !force && peekPurchaseOrdersFromCache() !== null;
    if (!hadInstant) setLoading(true);
    else setRefreshing(true);
    setError(null);
    void listVendorOptions()
      .then((vendorRows) => {
        setVendors(Object.fromEntries(vendorRows.map((v) => [v.id, { label: v.label }])));
      })
      .catch(() => setVendors({}));
    try {
      const orders = await listPurchaseOrders();
      setRows(orders);
    } catch (err) {
      if (!hadInstant) setRows([]);
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

  const bucketCounts = useMemo(() => countPoBuckets(rows), [rows]);

  const filtered = useMemo(() => {
    let list = filterOrdersByPoBucket(enriched, bucket);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) => {
      const vendor = vendors[row.vendor_id]?.label || "";
      return (
        textTokenMatch(row.company_po_number || "", q) ||
        textTokenMatch(row.customer_name || "", q) ||
        textTokenMatch(row.approved_by_name || "", q) ||
        textTokenMatch(row.document_number, q) ||
        textTokenMatch(vendor, q)
      );
    });
  }, [enriched, bucket, query, vendors]);

  async function onExportBucket(target: PoOverviewBucket) {
    setError(null);
    const subset = filterOrdersByPoBucket(enriched, target);
    if (subset.length === 0) {
      setError(`No ${PO_OVERVIEW_BUCKET_LABELS[target]} rows to export.`);
      return;
    }
    setExportBusy(true);
    try {
      const commercial = await listPurchaseOrders({ includeCommercial: true });
      const idSet = new Set(subset.map((row) => row.id));
      const source = commercial.filter((row) => idSet.has(row.id));
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const slug = target.replace(/_/g, "-");
      const exportRows = buildOrderExportRows(source, vendors);
      await exportOrdersXlsx(`purchase-orders-${slug}-${stamp}.xlsx`, exportRows);
    } catch (err) {
      setError(formatApiError(err, "Failed to export purchase orders"));
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <div className={procurementUi.page}>
      <ProcurementPageHeader
        title="Purchase order overview"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading || exportBusy || filtered.length === 0}
              onClick={() => void onExportBucket(bucket)}
            >
              <FileSpreadsheet className="mr-1.5 size-3.5 text-[#0369A1]" />
              {exportBusy ? "Exporting…" : `Export ${PO_OVERVIEW_BUCKET_LABELS[bucket]}`}
            </Button>
            <Link
              href="/procurement/orders"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "cursor-pointer transition-colors duration-200",
              )}
            >
              Full PO list
            </Link>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load(true)}
              disabled={loading && rows.length === 0}
            >
              <RefreshCw
                className={cn("mr-1.5 size-3.5", (loading || refreshing) && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {BUCKETS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setBucket(key)}
            className={cn(
              "cursor-pointer rounded-xl border bg-card p-3.5 text-left shadow-sm transition-colors duration-200",
              bucket === key
                ? "border-primary ring-2 ring-primary/20"
                : "border-border/80 hover:border-primary/30",
            )}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {PO_OVERVIEW_BUCKET_LABELS[key]}
            </p>
            <p className="mt-2 font-mono text-2xl font-medium tabular-nums">
              {loading ? "—" : String(bucketCounts[key])}
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-2 h-7 cursor-pointer px-2 text-xs text-[#0369A1]"
              disabled={exportBusy || bucketCounts[key] === 0}
              onClick={(e) => {
                e.stopPropagation();
                void onExportBucket(key);
              }}
            >
              Export
            </Button>
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
            {PO_OVERVIEW_BUCKET_LABELS[bucket]} · {filtered.length} orders
          </p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter…"
            className={procurementUi.searchInput}
          />
        </div>
        <div className={procurementUi.tableScroll}>
          <table className={cn(procurementUi.table, "min-w-[900px]")}>
            <thead className={procurementUi.thead}>
              <tr>
                <th className={procurementUi.th}>Company PO</th>
                <th className={procurementUi.th}>Date</th>
                <th className={procurementUi.th}>Vendor</th>
                <th className={procurementUi.th}>Customer / approved by</th>
                <th className={procurementUi.th}>Amount</th>
                <th className={procurementUi.th}>GRN</th>
                <th className={procurementUi.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    No orders in this group.
                  </td>
                </tr>
              ) : null}
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className={cn(procurementUi.tr, "cursor-pointer")}
                  onClick={() => router.push(`/procurement/orders/${row.id}`)}
                >
                  <td className={cn(procurementUi.td, "font-medium tabular-nums")}>
                    {row.company_po_number || row.document_number}
                  </td>
                  <td className={procurementUi.td}>{row.document_date}</td>
                  <td className={procurementUi.td}>
                    {vendors[row.vendor_id]?.label || row.vendor_id.slice(0, 8)}
                  </td>
                  <td className={procurementUi.td}>{orderCustomerOrApproverLabel(row) || "—"}</td>
                  <td className={cn(procurementUi.tdNumeric)}>{formatInr(row.total_amount)}</td>
                  <td className={procurementUi.td}>
                    <Badge variant={grnBadgeVariant(row.grn_status ?? "pending")} className="uppercase">
                      {formatGrnStatusBadgeLabel(row.grn_status ?? "pending")}
                    </Badge>
                  </td>
                  <td className={procurementUi.td}>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
