"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import {
  ProcurementListSearch,
  ProcurementPageHeader,
} from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listDeliveryChallans, getDeliveryChallan, type DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import {
  deliveryStatusRowFromChallan,
  getDeliveryStatus,
  isDeliveryStatusPersisted,
  shipmentStatusBadgeVariant,
  type DeliveryStatusRow,
} from "@/utils/delivery-status-storage";
import { DeliveryStatusShipmentModal } from "@/components/procurement/delivery-status-shipment-modal";
import { DeliveryStatusViewModal } from "@/components/procurement/delivery-status-view-modal";
import { deliveryStatusUpdateHref } from "@/utils/delivery-status-routes";
import {
  consumeDeliveryStatusFlash,
  setDeliveryStatusFlash,
} from "@/utils/delivery-status-flash";

export function DeliveryStatusListPage() {
  const [challans, setChallans] = useState<DeliveryChallanRecord[]>([]);
  const [query, setQuery] = useState("");
  const [statusVersion, setStatusVersion] = useState(0);
  const [flash, setFlash] = useState<ReturnType<typeof consumeDeliveryStatusFlash>>(null);
  const [viewChallanId, setViewChallanId] = useState<string | null>(null);
  const [updateChallanId, setUpdateChallanId] = useState<string | null>(null);

  const viewChallan = viewChallanId ? getDeliveryChallan(viewChallanId) : null;
  const updateChallan = updateChallanId ? getDeliveryChallan(updateChallanId) : null;

  function onModalSaved(message: string) {
    setDeliveryStatusFlash({ variant: "success", message });
    load();
    setViewChallanId(null);
    setUpdateChallanId(null);
  }

  const load = useCallback(() => {
    setChallans(listDeliveryChallans());
    setStatusVersion((v) => v + 1);
    setFlash(consumeDeliveryStatusFlash());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo((): DeliveryStatusRow[] => {
    return challans.map((challan) => deliveryStatusRowFromChallan(challan));
  }, [challans, statusVersion]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.purchaseOrderNumber,
        row.grnSummary,
        row.challanNumber,
        row.customerName,
        row.vendorName,
        row.shipmentStatus,
        row.trackingNumber,
        row.courierTransportDetails,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query]);

  return (
    <div className={procurementUi.page}>
      <ProcurementPageHeader
        title="Delivery status"
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

      <ProcurementListSearch
        value={query}
        onChange={setQuery}
        placeholder="Search…"
        aria-label="Search delivery status"
      />

      <div className={procurementUi.tableShell}>
        <div className={procurementUi.tableScroll}>
          <table className={cn(procurementUi.table, "min-w-[880px]")}>
            <thead className={procurementUi.thead}>
              <tr>
                <th className={procurementUi.th}>PO</th>
                <th className={procurementUi.th}>GRN</th>
                <th className={procurementUi.th}>Challan</th>
                <th className={procurementUi.th}>Customer</th>
                <th className={procurementUi.th}>Status</th>
                <th className={procurementUi.th}>Dispatch</th>
                <th className={procurementUi.th}>Expected</th>
                <th className={procurementUi.th}> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className={procurementUi.empty}>
                    {challans.length === 0
                      ? "No challans to track yet."
                      : "No rows match your search."}
                  </td>
                </tr>
              ) : null}
              {filtered.map((row, index) => {
                const prev = index > 0 ? filtered[index - 1] : null;
                const samePoAsPrev =
                  prev && prev.purchaseOrderNumber === row.purchaseOrderNumber;
                const saved = getDeliveryStatus(row.challanId);
                const statusLabel = saved?.shipmentStatus || row.shipmentStatus;
                return (
                  <tr
                    key={row.challanId}
                    className={cn(procurementUi.tr, samePoAsPrev && "bg-muted/10")}
                  >
                    <td className={cn(procurementUi.td, "font-medium tabular-nums")}>
                      {row.purchaseOrderNumber}
                    </td>
                    <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                      {row.grnSummary}
                    </td>
                    <td className={cn(procurementUi.tdNumeric)}>{row.challanNumber}</td>
                    <td className={procurementUi.tdMuted}>{row.customerName || "—"}</td>
                    <td className={procurementUi.td}>
                      <Badge
                        variant={shipmentStatusBadgeVariant(statusLabel)}
                        className={procurementUi.statusBadge}
                      >
                        {statusLabel}
                      </Badge>
                    </td>
                    <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                      {row.dispatchDate || "—"}
                    </td>
                    <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                      {row.expectedDeliveryDate || "—"}
                    </td>
                    <td className={procurementUi.td}>
                      <div className="flex flex-wrap items-center justify-end gap-0.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={cn(
                            procurementUi.actionBtn,
                            "text-[#0369A1] hover:text-[#0369A1]",
                          )}
                          onClick={() => setViewChallanId(row.challanId)}
                        >
                          View
                        </Button>
                        {isDeliveryStatusPersisted(row.challanId) ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={cn(
                              procurementUi.actionBtn,
                              "text-[#0369A1] hover:text-[#0369A1]",
                            )}
                            onClick={() => setUpdateChallanId(row.challanId)}
                          >
                            Update
                          </Button>
                        ) : (
                          <Link
                            href={deliveryStatusUpdateHref(row.challanId)}
                            className={cn(
                              buttonVariants({ size: "sm", variant: "ghost" }),
                              procurementUi.actionBtn,
                              "text-[#0369A1] hover:text-[#0369A1]",
                            )}
                          >
                            Set up
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <DeliveryStatusViewModal
        open={viewChallanId !== null}
        challan={viewChallan}
        onClose={() => setViewChallanId(null)}
        onSaved={onModalSaved}
      />
      <DeliveryStatusShipmentModal
        open={updateChallanId !== null}
        challan={updateChallan}
        onClose={() => setUpdateChallanId(null)}
        onSaved={onModalSaved}
      />
    </div>
  );
}
