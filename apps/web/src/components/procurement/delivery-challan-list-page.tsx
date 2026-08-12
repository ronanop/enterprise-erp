"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileDown, FilePlus2, RefreshCw, Truck } from "lucide-react";

import { DeliveryChallanViewDialog } from "@/components/procurement/delivery-challan-view-dialog";
import {
  ProcurementListSearch,
  ProcurementPageHeader,
} from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildDeliveryChallanPdfInputFromRecord,
  downloadDeliveryChallanPdf,
} from "@/utils/delivery-challan-pdf";
import {
  formatChallanGrnSummary,
  formatChallanItemsSummary,
  formatDeliveryModeLabel,
  listDeliveryChallans,
  type DeliveryChallanRecord,
} from "@/utils/delivery-challan-storage";
import {
  getDeliveryStatus,
  shipmentStatusBadgeVariant,
} from "@/utils/delivery-status-storage";
import { deliveryStatusUpdateHref } from "@/utils/delivery-status-routes";

const LIST_RETURN_TO = encodeURIComponent("/procurement/delivery-challan");

export function DeliveryChallanListPage() {
  const [rows, setRows] = useState<DeliveryChallanRecord[]>(() => listDeliveryChallans());
  const [query, setQuery] = useState("");
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [viewChallan, setViewChallan] = useState<DeliveryChallanRecord | null>(null);
  const [statusVersion, setStatusVersion] = useState(0);

  const load = useCallback(() => {
    setRows(listDeliveryChallans());
    setStatusVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? rows.filter((row) => {
          const status = getDeliveryStatus(row.id);
          const haystack = [
            row.challanNumber,
            row.purchaseOrderNumber,
            formatChallanGrnSummary(row),
            row.entityName,
            row.vendorName,
            row.customerName,
            formatDeliveryModeLabel(row.deliveryMode),
            row.transportDetails,
            row.driverVehicleDetails,
            status?.shipmentStatus,
            status?.trackingNumber,
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        })
      : rows;
    return [...base].sort((a, b) => {
      const poCmp = (a.purchaseOrderNumber || "").localeCompare(
        b.purchaseOrderNumber || "",
        undefined,
        { numeric: true },
      );
      if (poCmp !== 0) return poCmp;
      const dateCmp = (b.challanDate || "").localeCompare(a.challanDate || "");
      if (dateCmp !== 0) return dateCmp;
      return (b.challanNumber || "").localeCompare(a.challanNumber || "", undefined, {
        numeric: true,
      });
    });
  }, [rows, query, statusVersion]);

  async function onDownloadPdf(row: DeliveryChallanRecord) {
    setPdfBusyId(row.id);
    setPdfError(null);
    try {
      const input = buildDeliveryChallanPdfInputFromRecord(row);
      await downloadDeliveryChallanPdf(input);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Failed to download PDF");
    } finally {
      setPdfBusyId(null);
    }
  }

  return (
    <div className={procurementUi.page}>
      <ProcurementPageHeader
        title="Delivery challan"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={load}
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Refresh
            </Button>
            <Link
              href={`/procurement/delivery-challan/new?returnTo=${LIST_RETURN_TO}`}
              className={cn(
                buttonVariants({ size: "sm" }),
                "cursor-pointer transition-colors duration-200",
              )}
            >
              <FilePlus2 className="mr-1.5 size-3.5" />
              Create
            </Link>
          </div>
        }
      />

      {pdfError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {pdfError}
        </div>
      ) : null}

      <ProcurementListSearch
        value={query}
        onChange={setQuery}
        placeholder="Search…"
        aria-label="Search delivery challans"
      />

      <div className={procurementUi.tableShell}>
        <div className={cn(procurementUi.tableScroll)}>
          <table className={cn(procurementUi.table, "min-w-[960px]")}>
            <thead className={procurementUi.thead}>
              <tr>
                <th className={procurementUi.th}>Challan</th>
                <th className={procurementUi.th}>Date</th>
                <th className={procurementUi.th}>GRN</th>
                <th className={procurementUi.th}>Status</th>
                <th className={procurementUi.th}>Vendor</th>
                <th className={procurementUi.th}>Customer</th>
                <th className={procurementUi.th}>Items</th>
                <th className={procurementUi.th}> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className={procurementUi.empty}>
                    {rows.length === 0
                      ? "No delivery challans yet."
                      : "No challans match your search."}
                  </td>
                </tr>
              ) : null}
              {filtered.map((row, index) => {
                const prev = index > 0 ? filtered[index - 1] : null;
                const samePoAsPrev =
                  prev &&
                  prev.purchaseOrderNumber &&
                  prev.purchaseOrderNumber === row.purchaseOrderNumber;
                const statusLabel =
                  getDeliveryStatus(row.id)?.shipmentStatus || "Pending dispatch";
                return (
                  <tr
                    key={row.id}
                    className={cn(procurementUi.tr, samePoAsPrev && "bg-muted/10")}
                  >
                    <td className={cn(procurementUi.td, "font-medium tabular-nums")}>
                      {row.challanNumber}
                    </td>
                    <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                      {row.challanDate}
                    </td>
                    <td
                      className={cn(
                        procurementUi.td,
                        "max-w-[160px] font-medium tabular-nums",
                      )}
                    >
                      {formatChallanGrnSummary(row)}
                    </td>
                    <td className={procurementUi.td}>
                      <div className={procurementUi.rowActions}>
                        <Badge
                          variant={shipmentStatusBadgeVariant(statusLabel)}
                          className={procurementUi.statusBadge}
                        >
                          {statusLabel}
                        </Badge>
                        <Link
                          href={deliveryStatusUpdateHref(row.id)}
                          className={cn(
                            buttonVariants({ size: "sm", variant: "ghost" }),
                            procurementUi.actionBtn,
                            "text-[#0369A1] hover:text-[#0369A1]",
                          )}
                        >
                          <Truck className="size-3.5" />
                          Status
                        </Link>
                      </div>
                    </td>
                    <td className={procurementUi.tdMuted}>{row.vendorName || "—"}</td>
                    <td className={procurementUi.td}>{row.customerName || "—"}</td>
                    <td className={procurementUi.tdMuted}>
                      {formatChallanItemsSummary(row.lines)}
                    </td>
                    <td className={procurementUi.td}>
                      <div className={procurementUi.rowActions}>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={cn(
                            procurementUi.actionBtn,
                            "text-[#0369A1] hover:text-[#0369A1]",
                          )}
                          onClick={() => setViewChallan(row)}
                        >
                          View
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={procurementUi.actionBtn}
                          disabled={pdfBusyId === row.id}
                          title="Download PDF"
                          aria-label={`Download PDF for ${row.challanNumber}`}
                          onClick={() => void onDownloadPdf(row)}
                        >
                          <FileDown className="size-3.5" />
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

      <DeliveryChallanViewDialog
        open={Boolean(viewChallan)}
        challan={viewChallan}
        onClose={() => setViewChallan(null)}
      />
    </div>
  );
}
