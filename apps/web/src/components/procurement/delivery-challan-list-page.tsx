"use client";

/** Delivery challan queue — pending GRNs only (no saved-challan table or search). */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus2, FileText, RefreshCw, Truck } from "lucide-react";

import { ProcurementPageHeader } from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GrnChallanKind } from "@/utils/delivery-challan-storage";
import { Badge } from "@/components/ui/badge";
import {
  listAllGrnChallansByKind,
  pendingGrnChallanHref,
  type PendingGrnChallan,
} from "@/utils/grn-challan-pending";

const LIST_RETURN_TO = encodeURIComponent("/procurement/delivery-challan");

type QueueTab = GrnChallanKind;

export function DeliveryChallanListPage() {
  const [tab, setTab] = useState<QueueTab>("delivery_challan");
  const [pendingBilling, setPendingBilling] = useState<PendingGrnChallan[]>([]);
  const [pendingDc, setPendingDc] = useState<PendingGrnChallan[]>([]);

  const load = useCallback(() => {
    setPendingBilling(listAllGrnChallansByKind("billing"));
    setPendingDc(listAllGrnChallansByKind("delivery_challan"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingForTab = tab === "billing" ? pendingBilling : pendingDc;
  const pendingDcCount = pendingDc.filter((r) => !r.status || r.status === "pending").length;
  const pendingBillingCount = pendingBilling.filter((r) => !r.status || r.status === "pending").length;

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

      <PendingGrnQueueCard
        label={tab === "billing" ? "Billing GRNs" : "Delivery challan GRNs"}
        rows={pendingForTab}
        isBilling={tab === "billing"}
        actionLabel="View"
        emptyLabel={
          tab === "billing"
            ? "No billing GRNs waiting."
            : "No delivery challan GRNs waiting."
        }
      />
    </div>
  );
}

function pendingDate(iso: string): string {
  const day = (iso || "").slice(0, 10);
  return day || "—";
}

function PendingGrnQueueCard({
  label,
  rows,
  isBilling,
  actionLabel,
  emptyLabel,
}: {
  label: string;
  rows: PendingGrnChallan[];
  isBilling: boolean;
  actionLabel: string;
  emptyLabel: string;
}) {
  const router = useRouter();

  return (
    <div className={procurementUi.tableShell} aria-label={label}>
      <div className={procurementUi.tableScroll}>
        <table className={cn(procurementUi.table, "min-w-[1060px]")}>
          <thead className={procurementUi.thead}>
            <tr>
              <th className={procurementUi.th}>{isBilling ? "Invoice number" : "Challan number"}</th>
              <th className={procurementUi.th}>{isBilling ? "Invoice date" : "Challan date"}</th>
              <th className={procurementUi.th}>PO number</th>
              <th className={procurementUi.th}>GRN number</th>
              <th className={procurementUi.th}>GRN date</th>
              <th className={procurementUi.th}>Vendor name</th>
              <th className={procurementUi.th}>Customer name</th>
              <th className={procurementUi.th}>Status</th>
              <th className={procurementUi.th}>View</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className={procurementUi.empty}>
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isSaved = row.status === "saved";
                const href = isSaved && row.savedRecordId
                  ? `/procurement/delivery-challan/${row.savedRecordId}`
                  : pendingGrnChallanHref(row);
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
                  <td className={cn(procurementUi.td, "max-w-[160px] font-medium tabular-nums")}>
                    {row.purchaseOrderNumber || "—"}
                  </td>
                  <td className={cn(procurementUi.td, "max-w-[160px] font-medium tabular-nums")}>
                    {row.grnNumber || "—"}
                  </td>
                  <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                    {pendingDate(row.createdAt)}
                  </td>
                  <td className={procurementUi.tdMuted}>{row.vendorName || "—"}</td>
                  <td className={procurementUi.td}>{row.customerName?.trim() || "—"}</td>
                  <td className={procurementUi.td}>
                    {isSaved ? (
                      <Badge variant="default" className={cn(procurementUi.statusBadge, "bg-emerald-600 text-white hover:bg-emerald-600")}>
                        Sent
                      </Badge>
                    ) : (
                      <Badge variant="warning" className={procurementUi.statusBadge}>
                        Pending
                      </Badge>
                    )}
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
                        View
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
