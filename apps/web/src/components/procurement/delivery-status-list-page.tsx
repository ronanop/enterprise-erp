"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, RefreshCw } from "lucide-react";

import {
  ProcurementListSearch,
  ProcurementPageHeader,
} from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listDeliveryChallans } from "@/utils/delivery-challan-storage";
import {
  buildDeliveryStatusExportRows,
  exportDeliveryStatusXlsx,
} from "@/utils/delivery-status-excel-export";
import { consumeDeliveryStatusFlash } from "@/utils/delivery-status-flash";
import { deliveryStatusUpdateHref } from "@/utils/delivery-status-routes";
import {
  deliveryStatusRowFromChallan,
  shipmentStatusBadgeVariant,
  type DeliveryStatusRow,
} from "@/utils/delivery-status-storage";

function loadDeliveryStatusRows(): DeliveryStatusRow[] {
  return listDeliveryChallans().flatMap((challan) => {
    try {
      return [deliveryStatusRowFromChallan(challan)];
    } catch {
      return [];
    }
  });
}

export function DeliveryStatusListPage() {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState<ReturnType<typeof consumeDeliveryStatusFlash>>(null);
  const [rows, setRows] = useState<DeliveryStatusRow[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    setFlash(consumeDeliveryStatusFlash());
    setRows(loadDeliveryStatusRows());
  }, [version]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.purchaseOrderNumber,
        row.customerPoNumber,
        row.grnSummary,
        row.cacheInvoiceNumber,
        row.shipmentStatus,
        row.docketNumber,
        row.deliveryBoyName,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query]);

  function onExport() {
    setExportError(null);
    if (rows.length === 0) {
      setExportError("No delivery status rows available to export.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    exportDeliveryStatusXlsx(
      `delivery-status-${stamp}.xlsx`,
      buildDeliveryStatusExportRows(rows),
    );
  }

  return (
    <div className={procurementUi.page}>
      <ProcurementPageHeader
        title="Delivery status"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={onExport}
            >
              <FileSpreadsheet className="mr-1.5 size-3.5 text-[#0369A1]" />
              Export to Excel
            </Button>
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
          </div>
        }
      />

      {flash ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            flash.variant === "success"
              ? "border-sky-200 bg-sky-50 text-sky-900"
              : "border-amber-200 bg-amber-50 text-amber-950",
          )}
        >
          {flash.message}
        </div>
      ) : null}

      {exportError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {exportError}
        </div>
      ) : null}

      <ProcurementListSearch
        value={query}
        onChange={setQuery}
        placeholder="Search PO, GRN, or invoice…"
        aria-label="Search delivery status"
      />

      <div className={procurementUi.tableShell}>
        <div className={procurementUi.tableScroll}>
          <table className={cn(procurementUi.table, "min-w-[720px]")}>
            <thead className={procurementUi.thead}>
              <tr>
                <th className={procurementUi.th}>PO number</th>
                <th className={procurementUi.th}>GRN number</th>
                <th className={procurementUi.th}>Cache invoice number</th>
                <th className={procurementUi.th}>Delivery status</th>
                <th className={procurementUi.th}>View</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={procurementUi.empty}>
                    {rows.length === 0
                      ? "No GRNs to track yet."
                      : "No rows match your search."}
                  </td>
                </tr>
              ) : null}
              {filtered.map((row) => (
                <tr key={row.challanId} className={procurementUi.tr}>
                  <td className={cn(procurementUi.td, "font-medium tabular-nums")}>
                    {row.purchaseOrderNumber || "—"}
                  </td>
                  <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                    {row.grnSummary || "—"}
                  </td>
                  <td className={cn(procurementUi.tdNumeric)}>
                    {String(row.cacheInvoiceNumber ?? "").trim() || "—"}
                  </td>
                  <td className={procurementUi.td}>
                    <Badge
                      variant={shipmentStatusBadgeVariant(row.shipmentStatus)}
                      className={procurementUi.statusBadge}
                    >
                      {row.shipmentStatus}
                    </Badge>
                  </td>
                  <td className={procurementUi.td}>
                    <Link
                      href={deliveryStatusUpdateHref(row.challanId)}
                      className={cn(
                        buttonVariants({ size: "sm", variant: "ghost" }),
                        procurementUi.actionBtn,
                        "text-[#0369A1] hover:text-[#0369A1]",
                      )}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
