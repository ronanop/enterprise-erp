"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, CircleDot, FileSpreadsheet, Layers, PackageCheck, RefreshCw } from "lucide-react";

import { FinanceKpiCard } from "@/components/finance/finance-kpi-card";
import { GrnDeliveryChallanMenu } from "@/components/procurement/grn-delivery-challan-menu";
import {
  GrnReceiptHistoryDialog,
  type GrnReceiptPdfContext,
} from "@/components/procurement/grn-receipt-history-dialog";
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
  listVendorOptions,
  listVendorPos,
  type ScmVendorPo,
  type VendorOption,
} from "@/services/procurement-service";
import {
  buildDeliveryChallanPdfInputFromRecord,
  downloadDeliveryChallanPdf,
} from "@/utils/delivery-challan-pdf";
import {
  listDeliveryChallans,
  type DeliveryChallanRecord,
} from "@/utils/delivery-challan-storage";
import {
  buildGrnExportRows,
  exportGrnsXlsx,
} from "@/utils/grns-excel-export";
import { formatGrnStatusBadgeLabel } from "@/utils/grn-status-display";

type GrnFilter = "all" | "partial" | "closed";

function grnTone(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "closed" || status === "delivered") return "default";
  if (status === "partial") return "secondary";
  return "outline";
}

function isReceiptEligible(status: string): boolean {
  const value = status.toLowerCase();
  return value !== "draft" && value !== "submitted" && value !== "cancelled";
}

function isPartialOrDelivered(grnStatus: string | null | undefined): boolean {
  const value = (grnStatus ?? "").toLowerCase();
  return value === "partial" || value === "closed" || value === "delivered";
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

export function GrnsListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ScmVendorPo[]>([]);
  const [vendors, setVendors] = useState<Record<string, VendorOption>>({});
  const [filter, setFilter] = useState<GrnFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [challanPdfBusyId, setChallanPdfBusyId] = useState<string | null>(null);
  const [challansByOrder, setChallansByOrder] = useState<Record<string, DeliveryChallanRecord[]>>(
    () => (typeof window === "undefined" ? {} : challansByOrderIdMap()),
  );
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const [historyOrder, setHistoryOrder] = useState<{
    id: string;
    poLabel: string;
    vendorLabel: string;
    pdfContext: GrnReceiptPdfContext;
  } | null>(null);

  const load = useCallback(async (force = false) => {
    if (force) invalidateProcurementListCache();
    setLoading(true);
    setError(null);
    try {
      const [pos, vendorRows] = await Promise.all([
        listVendorPos(),
        listVendorOptions().catch(() => [] as VendorOption[]),
      ]);
      setRows(
        pos.filter(
          (row) => isReceiptEligible(row.status) && isPartialOrDelivered(row.grn_status),
        ),
      );
      setVendors(Object.fromEntries(vendorRows.map((v) => [v.id, v])));
      setChallansByOrder(challansByOrderIdMap());
    } catch (err) {
      setRows([]);
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
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!exportOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [exportOpen]);

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

  const showActionColumn = useMemo(
    () => filtered.some((row) => {
      const status = row.grn_status.toLowerCase();
      return status !== "closed" && status !== "delivered";
    }),
    [filtered],
  );

  const tableColSpan = showActionColumn ? 11 : 10;

  function onExport(mode: "all" | "filter") {
    setExportOpen(false);
    setError(null);
    const source = mode === "all" ? rows : filtered;
    if (source.length === 0) {
      setError(
        mode === "filter"
          ? "No GRNs match the current filter to export."
          : "No GRNs available to export.",
      );
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const exportRows = buildGrnExportRows(source, vendors);
    exportGrnsXlsx(
      mode === "all" ? `grns-all-${stamp}.xlsx` : `grns-filtered-${stamp}.xlsx`,
      exportRows,
    );
  }

  async function onDownloadChallanPdf(challan: DeliveryChallanRecord) {
    setChallanPdfBusyId(challan.id);
    setError(null);
    try {
      const input = buildDeliveryChallanPdfInputFromRecord(challan);
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
            <div className="relative" ref={exportMenuRef}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                disabled={loading}
                aria-expanded={exportOpen}
                aria-haspopup="menu"
                onClick={() => setExportOpen((open) => !open)}
              >
                <FileSpreadsheet className="mr-1.5 size-3.5 text-[#0369A1]" />
                Export to Excel
                <ChevronDown className="ml-1 size-3.5" />
              </Button>
              {exportOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-border bg-card shadow-md"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full cursor-pointer flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted/60"
                    onClick={() => onExport("all")}
                  >
                    <span className="text-sm font-medium text-foreground">Export all</span>
                    <span className="text-xs text-muted-foreground">
                      Every partial or delivered GRN PO
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full cursor-pointer flex-col items-start gap-0.5 border-t border-border px-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted/60"
                    onClick={() => onExport("filter")}
                  >
                    <span className="text-sm font-medium text-foreground">Export by filter</span>
                    <span className="text-xs text-muted-foreground">
                      Only rows matching the current filter
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
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

      <div className="grid gap-3 sm:grid-cols-3">
        <FinanceKpiCard label="Receipt POs" value={String(kpis.total)} icon={PackageCheck} />
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
        <div className="flex flex-wrap gap-1.5">
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
          <table
            className={cn(
              procurementUi.table,
              showActionColumn ? "min-w-[1180px]" : "min-w-[1060px]",
            )}
          >
            <thead className={procurementUi.thead}>
              <tr>
                <th className="px-3 py-2 font-medium">Company PO number</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium">Vendor amt</th>
                <th className="px-3 py-2 font-medium">Customer amt</th>
                <th className="px-3 py-2 font-medium">Margin</th>
                <th className="px-3 py-2 font-medium">GRN</th>
                <th className="px-3 py-2 font-medium">Received</th>
                {showActionColumn ? (
                  <th className="px-3 py-2 font-medium">Action</th>
                ) : null}
                <th className={procurementUi.th}>Challans</th>
                <th className="px-3 py-2 text-center font-medium">GRN detail</th>
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
                const isDelivered =
                  row.grn_status === "closed" || row.grn_status === "delivered";
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
                    <td className="px-3 py-2 font-medium tabular-nums">
                      {row.company_po_number || row.document_number || "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.document_date}</td>
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
                      <Badge variant={grnTone(row.grn_status)} className="uppercase">
                        {grnLabel}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {receivedQty} / {orderedQty}
                    </td>
                    {showActionColumn ? (
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        {isDelivered ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Link
                            href={orderHref}
                            className={cn(
                              buttonVariants({ size: "sm", variant: "outline" }),
                              "cursor-pointer transition-colors duration-200",
                            )}
                          >
                            Continue
                          </Link>
                        )}
                      </td>
                    ) : null}
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
                          className="h-8 cursor-pointer gap-1.5 border-border px-2.5 text-xs transition-colors duration-200 hover:bg-muted/50"
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
                          <Layers className="size-3.5 text-[#0369A1]" />
                          View
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
        />
      ) : null}
    </div>
  );
}
