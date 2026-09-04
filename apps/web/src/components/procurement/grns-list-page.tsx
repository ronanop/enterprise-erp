"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleDot, Eye, FileSpreadsheet, PackageCheck, RefreshCw } from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { GrnDeliveryChallanMenu } from "@/components/procurement/grn-delivery-challan-menu";
import {
  GrnReceiptHistoryDialog,
  type GrnReceiptPdfContext,
} from "@/components/procurement/grn-receipt-history-dialog";
import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatApiError } from "@/services/api-client";
import {
  formatInr,
  invalidateProcurementListCache,
  listVendorOptions,
  listVendorPos,
  peekVendorPosFromCache,
  type ScmVendorPo,
  type VendorOption,
} from "@/services/procurement-service";
import {
  buildDeliveryChallanPdfInputFromRecordResolved,
  downloadDeliveryChallanPdf,
} from "@/utils/delivery-challan-pdf";
import {
  listDeliveryChallans,
  type DeliveryChallanRecord,
} from "@/utils/delivery-challan-storage";
import {
  buildGrnExportRowsWithBatches,
  exportGrnsXlsx,
} from "@/utils/grns-excel-export";
import { formatGrnStatusBadgeLabel, grnBadgeVariant } from "@/utils/grn-status-display";

type GrnFilter = "all" | "partial" | "closed";

function isReceiptEligible(status: string): boolean {
  const value = status.toLowerCase();
  return value !== "draft" && value !== "submitted" && value !== "cancelled";
}

function isPartialOrDelivered(grnStatus: string | null | undefined): boolean {
  const value = (grnStatus ?? "").toLowerCase();
  return value === "partial" || value === "closed" || value === "delivered";
}

function formatPoCreatedDate(row: ScmVendorPo): string {
  const raw = row.created_at || row.document_date;
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return String(raw).slice(0, 10);
  }
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function deliveryChallanHref(orderId: string): string {
  const returnTo = encodeURIComponent("/procurement/delivery-challan");
  return `/procurement/delivery-challan/new?orderId=${encodeURIComponent(orderId)}&returnTo=${returnTo}`;
}

function buildGrnPdfContext(row: ScmVendorPo, vendor?: VendorOption): GrnReceiptPdfContext {
  const vendorEntry = vendor?.addressEntries?.[0];
  const vendorAddressRaw = vendorEntry?.address || vendor?.address || "";
  const vendorAddressLines = vendorAddressRaw.includes("\n")
    ? vendorAddressRaw
        .split(/\r?\n/)
        .map((part) => part.trim())
        .filter(Boolean)
    : vendorAddressRaw.trim()
      ? [vendorAddressRaw.trim()]
      : [];
  return {
    poNumber: row.company_po_number?.trim() || row.document_number,
    documentDate: row.receipt_saved_at || row.document_date,
    vendorName: vendor?.label,
    vendorAddressLines,
    vendorGstNumber: vendorEntry?.gstNumber || vendor?.taxNumber,
  };
}

function challansByOrderIdMap(): Record<string, DeliveryChallanRecord[]> {
  const map: Record<string, DeliveryChallanRecord[]> = {};
  for (const challan of listDeliveryChallans()) {
    const orderId = challan.orderId?.trim();
    if (!orderId) continue;
    if (!map[orderId]) map[orderId] = [];
    map[orderId].push(challan);
  }
  for (const orderId of Object.keys(map)) {
    map[orderId].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }
  return map;
}

function grnReceiptRowsFromVendorPos(pos: ScmVendorPo[]): ScmVendorPo[] {
  return pos.filter(
    (row) => isReceiptEligible(row.status) && isPartialOrDelivered(row.grn_status),
  );
}

export function GrnsListPage() {
  const router = useRouter();
  const cachedPosOnMount = peekVendorPosFromCache();
  const initialGrnRows = cachedPosOnMount ? grnReceiptRowsFromVendorPos(cachedPosOnMount) : [];
  const [rows, setRows] = useState<ScmVendorPo[]>(() => initialGrnRows);
  const [vendors, setVendors] = useState<Record<string, VendorOption>>({});
  const [filter, setFilter] = useState<GrnFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(() => cachedPosOnMount === null);
  const [refreshing, setRefreshing] = useState(false);
  const [challanPdfBusyId, setChallanPdfBusyId] = useState<string | null>(null);
  const [challansByOrder, setChallansByOrder] = useState<Record<string, DeliveryChallanRecord[]>>(
    () => (typeof window === "undefined" ? {} : challansByOrderIdMap()),
  );
  const [error, setError] = useState<string | null>(null);
  const [historyOrder, setHistoryOrder] = useState<{
    id: string;
    poLabel: string;
    vendorLabel: string;
    pdfContext: GrnReceiptPdfContext;
  } | null>(null);

  const load = useCallback(async (force = false) => {
    if (force) invalidateProcurementListCache();
    const hadInstant = !force && peekVendorPosFromCache() !== null;
    if (!hadInstant) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const [pos, vendorRows] = await Promise.all([
        listVendorPos(),
        listVendorOptions().catch(() => [] as VendorOption[]),
      ]);
      setRows(grnReceiptRowsFromVendorPos(pos));
      setVendors(Object.fromEntries(vendorRows.map((v) => [v.id, v])));
      setChallansByOrder(challansByOrderIdMap());
    } catch (err) {
      if (!hadInstant) {
        setRows([]);
      }
      const message = formatApiError(err, "Failed to load GRN status");
      const hint =
        /sign in|session expired|unauthorized|missing authentication/i.test(message)
          ? ""
          : /failed to fetch|network|load failed|unreachable|web page instead/i.test(message) ||
              message === "Failed to load GRN status"
            ? " Start the API on port 8000 and sign in, then refresh."
            : "";
      setError(`${message}${hint}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === "partial") {
      list = list.filter((row) => row.grn_status === "partial");
    } else if (filter === "closed") {
      list = list.filter((row) => {
        const status = row.grn_status.toLowerCase();
        return status === "closed" || status === "delivered";
      });
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) => {
      const vendor = vendors[row.vendor_id]?.label || "";
      return (
        (row.company_po_number || "").toLowerCase().includes(q) ||
        row.document_number.toLowerCase().includes(q) ||
        row.grn_status.toLowerCase().includes(q) ||
        vendor.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, query, vendors]);

  const kpis = useMemo(
    () => ({
      total: rows.length,
      partial: rows.filter((row) => row.grn_status === "partial").length,
      closed: rows.filter((row) => {
        const status = row.grn_status.toLowerCase();
        return status === "closed" || status === "delivered";
      }).length,
    }),
    [rows],
  );

  const tableColSpan = 11;

  async function onExport() {
    setError(null);
    const source = rows;
    if (source.length === 0) {
      setError("No GRNs available to export.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    try {
      const exportRows = await buildGrnExportRowsWithBatches(source, vendors);
      await exportGrnsXlsx(`grns-all-${stamp}.xlsx`, exportRows);
    } catch (err) {
      setError(formatApiError(err, "Export failed"));
    }
  }

  async function onDownloadChallanPdf(challan: DeliveryChallanRecord) {
    setChallanPdfBusyId(challan.id);
    setError(null);
    try {
      const input = await buildDeliveryChallanPdfInputFromRecordResolved(challan);
      await downloadDeliveryChallanPdf(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download delivery challan PDF");
    } finally {
      setChallanPdfBusyId(null);
    }
  }

  return (
    <div className={procurementUi.page}>
      <ProcurementPageHeader
        title="GRNs"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              disabled={loading}
              onClick={() => void onExport()}
            >
              <FileSpreadsheet className="mr-1.5 size-3.5 text-[#0369A1]" />
              Export to Excel
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

      <div className="grid gap-3 sm:grid-cols-3">
        <FinanceKpiCard
          label={
            <>
              Receipt PO<span className="normal-case">s</span>
            </>
          }
          value={String(kpis.total)}
          icon={PackageCheck}
        />
        <FinanceKpiCard
          label="GRN partial"
          value={String(kpis.partial)}
          tone="warning"
          icon={CircleDot}
        />
        <FinanceKpiCard
          label="GRN delivered"
          value={String(kpis.closed)}
          tone="success"
          icon={PackageCheck}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "partial", "closed"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                filter === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {key === "all" ? "All" : key === "closed" ? "Delivered" : "Partial"}
            </button>
          ))}
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter POs / vendors…"
          className="h-8 max-w-xs shadow-none"
        />
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className={procurementUi.tableShell}>
        <div className={procurementUi.tableScroll}>
          <table className={cn(procurementUi.table, "min-w-[1100px]")}>
            <thead className={procurementUi.thead}>
              <tr>
                <th className="px-3 py-2 font-bold">Company PO number</th>
                <th className="px-3 py-2 font-bold">PO date</th>
                <th className="px-3 py-2 font-bold">Vendor</th>
                <th className="px-3 py-2 font-bold">Vendor amt</th>
                <th className="px-3 py-2 font-bold">Customer amt</th>
                <th className="px-3 py-2 font-bold">Margin</th>
                <th className="px-3 py-2 font-bold">GRN</th>
                <th className="px-3 py-2 font-bold">Received</th>
                <th className={procurementUi.th}>Challans</th>
                <th className="px-3 py-2 text-center font-bold">GRN detail</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-3 py-8 text-center text-muted-foreground">
                    Loading GRNs…
                  </td>
                </tr>
              ) : null}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-3 py-8 text-center text-muted-foreground">
                    No partial or delivered POs yet. Record receipt on an issued PO first.
                  </td>
                </tr>
              ) : null}
              {filtered.map((row) => {
                const orderedQty = (row.lines || []).reduce(
                  (sum, ln) => sum + (Number(ln.quantity) || 0),
                  0,
                );
                const receivedQty = (row.lines || []).reduce(
                  (sum, ln) => sum + (Number(ln.quantity_received) || 0),
                  0,
                );
                const vendorAmt = Number(row.vendor_total ?? row.total_amount) || 0;
                const customerAmt = Number(row.customer_total) || 0;
                const marginAmt =
                  Number(row.margin_amount) ||
                  (customerAmt > 0 ? customerAmt - vendorAmt : 0);
                const grnLabel = formatGrnStatusBadgeLabel(row.grn_status);
                const orderHref = `/procurement/orders/${row.id}?tab=grn&from=grns`;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border/70 cursor-pointer transition-colors duration-150",
                      "hover:bg-muted/40 active:bg-muted/55",
                    )}
                    onClick={() => router.push(orderHref)}
                  >
                    <td className="px-3 py-2 font-medium tabular-nums">
                      {row.company_po_number || row.document_number || "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatPoCreatedDate(row)}</td>
                    <td className="px-3 py-2">
                      {vendors[row.vendor_id]?.label || row.vendor_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatInr(vendorAmt)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {customerAmt > 0 ? formatInr(customerAmt) : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {customerAmt > 0 || Number(row.margin_amount) ? formatInr(marginAmt) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={grnBadgeVariant(row.grn_status)} className="uppercase">
                        {grnLabel}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {receivedQty} / {orderedQty}
                    </td>
                    <td className={procurementUi.td} onClick={(e) => e.stopPropagation()}>
                      <GrnDeliveryChallanMenu
                        poLabel={row.company_po_number || row.document_number}
                        challans={challansByOrder[row.id] ?? []}
                        createHref={deliveryChallanHref(row.id)}
                        pdfBusyId={challanPdfBusyId}
                        onDownloadPdf={onDownloadChallanPdf}
                      />
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 cursor-pointer border-border p-0 text-[#0369A1] transition-colors duration-200 hover:bg-sky-50 hover:text-[#0369A1]"
                          title="View GRN batches, serials, and documents"
                          aria-label={`View GRN history for ${row.company_po_number || row.document_number}`}
                          onClick={() =>
                            setHistoryOrder({
                              id: row.id,
                              poLabel: row.company_po_number || row.document_number,
                              vendorLabel:
                                vendors[row.vendor_id]?.label || row.vendor_id.slice(0, 8),
                              pdfContext: buildGrnPdfContext(row, vendors[row.vendor_id]),
                            })
                          }
                        >
                          <Eye className="size-4 stroke-[2]" aria-hidden />
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

      {historyOrder ? (
        <GrnReceiptHistoryDialog
          open
          orderId={historyOrder.id}
          poLabel={historyOrder.poLabel}
          vendorLabel={historyOrder.vendorLabel}
          pdfContext={historyOrder.pdfContext}
          onClose={() => setHistoryOrder(null)}
          onReversed={() => void load(true)}
        />
      ) : null}
    </div>
  );
}
