"use client";

/** Delivery challan queue — pending + saved DCs with generated GRN numbers. */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus2, FileText, RefreshCw, Truck } from "lucide-react";

import {
  DeliveryBillTakenBadge,
  DeliveryBillTakenButton,
} from "@/components/procurement/delivery-bill-taken-badge";
import { DeliveryStatusBillDialog } from "@/components/procurement/delivery-status-bill-dialog";
import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  listProcurementInventory,
  type ProcurementInventoryRow,
} from "@/services/procurement-service";
import type { GrnChallanKind } from "@/utils/delivery-challan-storage";
import {
  getDeliveryChallan,
  upsertDeliveryChallan,
} from "@/utils/delivery-challan-storage";
import { resolveChallanBillStatus } from "@/utils/delivery-challan-bill";
import {
  listDeliveryChallanQueueByKind,
  patchPendingGrnChallan,
  pendingGrnChallanHref,
  type PendingGrnChallan,
} from "@/utils/grn-challan-pending";
import {
  formatGeneratedGrnNumbers,
  isGeneratedGrnNumber,
  resolveDisplayGrnNumbers,
  uniqueGeneratedGrnNumbers,
} from "@/utils/grn-number-display";
import { formatUniquePoLabels } from "@/utils/format-po-labels";

const LIST_RETURN_TO = encodeURIComponent("/procurement/delivery-challan");

type QueueTab = GrnChallanKind;

function enrichQueueRowsWithGeneratedGrns(
  rows: PendingGrnChallan[],
  inventory: ProcurementInventoryRow[],
): PendingGrnChallan[] {
  return rows.map((row) => {
    const saved =
      row.savedRecordId ? getDeliveryChallan(row.savedRecordId) : null;
    const numbers = resolveDisplayGrnNumbers({
      stored: [row.grnNumber, ...(saved?.selectedGrnNumbers || [])],
      orderId: row.orderId || saved?.orderId,
      inventory,
    });
    const label = formatGeneratedGrnNumbers(numbers);

    if (numbers.length > 0) {
      if (!isGeneratedGrnNumber(row.grnNumber) || row.grnNumber !== label) {
        patchPendingGrnChallan(row.orderId, row.batchKey, row.kind, {
          grnNumber: label,
        });
      }
      if (
        saved &&
        uniqueGeneratedGrnNumbers(saved.selectedGrnNumbers).join("\0") !== numbers.join("\0")
      ) {
        upsertDeliveryChallan({
          ...saved,
          selectedGrnNumbers: numbers,
        });
      }
    }

    return { ...row, grnNumber: label };
  });
}

export function DeliveryChallanListPage() {
  const [tab, setTab] = useState<QueueTab>("delivery_challan");
  const [pendingBilling, setPendingBilling] = useState<PendingGrnChallan[]>([]);
  const [pendingDc, setPendingDc] = useState<PendingGrnChallan[]>([]);
  const [billChallanId, setBillChallanId] = useState<string | null>(null);
  const [billTick, setBillTick] = useState(0);

  const load = useCallback(async () => {
    const billing = listDeliveryChallanQueueByKind("billing");
    const dc = listDeliveryChallanQueueByKind("delivery_challan");
    setPendingBilling(billing);
    setPendingDc(dc);

    try {
      const inventory = await listProcurementInventory();
      setPendingBilling(enrichQueueRowsWithGeneratedGrns(billing, inventory));
      setPendingDc(enrichQueueRowsWithGeneratedGrns(dc, inventory));
    } catch {
      /* keep local queue rows if inventory is unavailable */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingForTab = tab === "billing" ? pendingBilling : pendingDc;
  const pendingDcCount = pendingDc.filter((r) => !r.status || r.status === "pending").length;
  const pendingBillingCount = pendingBilling.filter((r) => !r.status || r.status === "pending").length;

  return (
    <div className={procurementUi.page}>
      <ProcurementPageHeader
        title="Delivery"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
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

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Delivery challan or billing"
      >
        <Button
          type="button"
          role="tab"
          aria-selected={tab === "delivery_challan"}
          size="sm"
          variant={tab === "delivery_challan" ? "default" : "outline"}
          className="cursor-pointer transition-colors duration-200"
          onClick={() => setTab("delivery_challan")}
        >
          <Truck className="mr-1.5 size-3.5" />
          Delivery challan
          {pendingDcCount > 0 ? (
            <span className="ml-1.5 rounded-md bg-background/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {pendingDcCount}
            </span>
          ) : null}
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={tab === "billing"}
          size="sm"
          variant={tab === "billing" ? "default" : "outline"}
          className="cursor-pointer transition-colors duration-200"
          onClick={() => setTab("billing")}
        >
          <FileText className="mr-1.5 size-3.5" />
          Billing
          {pendingBillingCount > 0 ? (
            <span className="ml-1.5 rounded-md bg-background/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {pendingBillingCount}
            </span>
          ) : null}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Delivery challan = item delivered without taking a bill. Show and update{" "}
        <span className="font-medium text-foreground">bill taken</span> on saved DCs at any time.
      </p>

      <PendingGrnQueueCard
        label={tab === "billing" ? "Billing GRNs" : "Delivery challan GRNs"}
        rows={pendingForTab}
        isBilling={tab === "billing"}
        actionLabel="View"
        billTick={billTick}
        onBill={(challanId) => setBillChallanId(challanId)}
        emptyLabel={
          tab === "billing"
            ? "No billing documents yet."
            : "No delivery challans yet."
        }
      />

      <DeliveryStatusBillDialog
        open={Boolean(billChallanId)}
        challanId={billChallanId}
        onClose={() => setBillChallanId(null)}
        onSaved={() => {
          void load();
          setBillTick((n) => n + 1);
        }}
      />
    </div>
  );
}

function PendingGrnQueueCard({
  label,
  rows,
  isBilling,
  actionLabel,
  emptyLabel,
  billTick,
  onBill,
}: {
  label: string;
  rows: PendingGrnChallan[];
  isBilling: boolean;
  actionLabel: string;
  emptyLabel: string;
  billTick: number;
  onBill: (challanId: string) => void;
}) {
  const router = useRouter();

  return (
    <div className={procurementUi.tableShell} aria-label={label}>
      <div className={procurementUi.tableScroll}>
        <table className={cn(procurementUi.table, "min-w-[980px]")}>
          <thead className={procurementUi.thead}>
            <tr>
              <th className={procurementUi.th}>{isBilling ? "Invoice number" : "Challan number"}</th>
              <th className={procurementUi.th}>{isBilling ? "Invoice date" : "Challan date"}</th>
              <th className={procurementUi.th}>PO number</th>
              <th className={procurementUi.th}>Vendor name</th>
              <th className={procurementUi.th}>Customer name</th>
              <th className={procurementUi.th}>Bill taken</th>
              <th className={procurementUi.th}>View</th>
            </tr>
          </thead>
          <tbody key={billTick}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className={procurementUi.empty}>
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isSaved = row.status === "saved";
                const href = isSaved && row.savedRecordId
                  ? `/procurement/delivery-challan/${row.savedRecordId}`
                  : pendingGrnChallanHref(row);
                const savedChallan =
                  isSaved && row.savedRecordId ? getDeliveryChallan(row.savedRecordId) : null;
                const billStatus = savedChallan
                  ? resolveChallanBillStatus(savedChallan)
                  : "none";
                return (
                <tr
                  key={row.id}
                  className={cn(procurementUi.tr, "cursor-pointer")}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(href)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(href);
                    }
                  }}
                >
                  <td className={cn(procurementUi.td, "font-medium tabular-nums", isSaved ? "text-foreground" : "text-muted-foreground")}>
                    {row.docNumber || "—"}
                  </td>
                  <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                    {row.docDate || "—"}
                  </td>
                  <td className={cn(procurementUi.td, "max-w-[220px] font-medium tabular-nums")}>
                    {formatUniquePoLabels(row.purchaseOrderNumber)}
                  </td>
                  <td className={procurementUi.tdMuted}>{row.vendorName || "—"}</td>
                  <td className={procurementUi.td}>{row.customerName?.trim() || "—"}</td>
                  <td className={procurementUi.td} onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap items-center gap-1">
                      <DeliveryBillTakenBadge status={billStatus} />
                      {savedChallan ? (
                        <DeliveryBillTakenButton
                          status={billStatus}
                          onClick={() => onBill(savedChallan.id)}
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className={procurementUi.td}>
                    <div className={procurementUi.rowActions}>
                      <Link
                        href={href}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          buttonVariants({ size: "sm", variant: "ghost" }),
                          procurementUi.actionBtn,
                          "text-[#0369A1] hover:text-[#0369A1]",
                        )}
                      >
                        {actionLabel}
                      </Link>
                    </div>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
