"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Receipt, RefreshCw } from "lucide-react";

import { DeliveryStatusBillDialog } from "@/components/procurement/delivery-status-bill-dialog";
import {
  ProcurementListSearch,
  ProcurementPageHeader,
} from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  aggregatePoDcBillStatus,
  challanDeliveredQuantity,
  deliveryBillStatusBadgeVariant,
  formatDeliveryBillStatusLabel,
  resolveDeliveryBillStatus,
} from "@/utils/delivery-challan-bill";
import { getDeliveryChallan, listDeliveryChallans } from "@/utils/delivery-challan-storage";
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

type DeliveryStatusListRow = DeliveryStatusRow & {
  billStatusLabel: string;
  billStatusKey: ReturnType<typeof resolveDeliveryBillStatus>;
  poBillStatus: string;
  canBill: boolean;
};

function loadDeliveryStatusRows(): DeliveryStatusListRow[] {
  return listDeliveryChallans().flatMap((challan) => {
    try {
      const row = deliveryStatusRowFromChallan(challan);
      const billStatusKey = resolveDeliveryBillStatus(
        row,
        challanDeliveredQuantity(challan),
      );
      return [
        {
          ...row,
          billStatusLabel: formatDeliveryBillStatusLabel(billStatusKey),
          billStatusKey,
          poBillStatus: aggregatePoDcBillStatus(challan.orderId),
          canBill:
            billStatusKey === "unbilled" || billStatusKey === "partially_billed",
        },
      ];
    } catch {
      return [];
    }
  });
}

export function DeliveryStatusListPage() {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState<ReturnType<typeof consumeDeliveryStatusFlash>>(null);
  const [rows, setRows] = useState<DeliveryStatusListRow[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const [billChallanId, setBillChallanId] = useState<string | null>(null);

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
        row.billInvoiceNumber,
        row.shipmentStatus,
        row.billStatusLabel,
        row.poBillStatus,
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

      <p className="text-sm text-muted-foreground">
        After delivery, the DC stays <span className="font-medium text-foreground">unbilled</span>{" "}
        until you mark it billed (partial or full). PO bill status follows those DC bills.
      </p>

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
        placeholder="Search PO, GRN, invoice, or bill status…"
        aria-label="Search delivery status"
      />

      <div className={procurementUi.tableShell}>
        <div className={procurementUi.tableScroll}>
          <table className={cn(procurementUi.table, "min-w-[980px]")}>
            <thead className={procurementUi.thead}>
              <tr>
                <th className={procurementUi.th}>PO number</th>
                <th className={procurementUi.th}>GRN number</th>
                <th className={procurementUi.th}>Invoice</th>
                <th className={procurementUi.th}>Delivery status</th>
                <th className={procurementUi.th}>DC bill status</th>
                <th className={procurementUi.th}>PO bill status</th>
                <th className={procurementUi.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={procurementUi.empty}>
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
                    {String(row.billInvoiceNumber || row.cacheInvoiceNumber || "").trim() || "—"}
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
                    <Badge
                      variant={deliveryBillStatusBadgeVariant(row.billStatusKey)}
                      className={procurementUi.statusBadge}
                    >
                      {row.billStatusLabel}
                    </Badge>
                  </td>
                  <td className={cn(procurementUi.td, "text-muted-foreground")}>
                    {row.poBillStatus}
                  </td>
                  <td className={procurementUi.td}>
                    <div className="flex flex-wrap items-center gap-1">
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
                      {row.canBill || row.billStatusKey === "fully_billed" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={cn(
                            procurementUi.actionBtn,
                            "cursor-pointer text-[#0369A1] hover:text-[#0369A1]",
                          )}
                          onClick={() => {
                            if (!getDeliveryChallan(row.challanId)) return;
                            setBillChallanId(row.challanId);
                          }}
                        >
                          <Receipt className="mr-1 size-3.5" />
                          {row.billStatusKey === "fully_billed" ? "Update bill" : "Bill"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DeliveryStatusBillDialog
        open={Boolean(billChallanId)}
        challanId={billChallanId}
        onClose={() => setBillChallanId(null)}
        onSaved={load}
      />
    </div>
  );
}
