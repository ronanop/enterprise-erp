"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, Wrench } from "lucide-react";

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
  deliveryStatusRowFromChallan,
  isDeliveredShipmentStatus,
  shipmentStatusBadgeVariant,
} from "@/utils/delivery-status-storage";
import { installationDetailHref } from "@/utils/installation-routes";
import { resolveInstallation } from "@/utils/installation-storage";

type InstallationListRow = {
  challanId: string;
  companyPoNumber: string;
  customerName: string;
  customerPoNumber: string;
  deliveredDate: string;
  challanOrInvoice: string;
  deliveryStatus: string;
  sharedToProject: boolean;
};

function loadInstallationRows(): InstallationListRow[] {
  return listDeliveryChallans().flatMap((challan) => {
    try {
      const status = deliveryStatusRowFromChallan(challan);
      const delivered =
        isDeliveredShipmentStatus(status.shipmentStatus) ||
        Boolean(status.actualDeliveryDate?.trim());
      if (!delivered || !status.requiresInstallation) return [];

      const invoice =
        status.cacheInvoiceNumber?.trim() ||
        status.billInvoiceNumber?.trim() ||
        challan.invoiceNumber?.trim() ||
        "";
      const challanNo = challan.challanNumber?.trim() || "";
      const install = resolveInstallation(challan.id);

      return [
        {
          challanId: challan.id,
          companyPoNumber:
            status.cachePoNumber ||
            challan.companyPoNumber ||
            challan.purchaseOrderNumber ||
            "—",
          customerName: status.customerName || challan.customerName || "—",
          customerPoNumber: status.customerPoNumber || "—",
          deliveredDate: status.actualDeliveryDate || "—",
          challanOrInvoice: invoice || challanNo || "—",
          deliveryStatus: status.shipmentStatus || "Delivered",
          sharedToProject: install.sharedToProject,
        },
      ];
    } catch {
      return [];
    }
  });
}

export function InstallationListPage() {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<InstallationListRow[]>([]);

  const load = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    setRows(loadInstallationRows());
  }, [version]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.companyPoNumber,
        row.customerName,
        row.customerPoNumber,
        row.deliveredDate,
        row.challanOrInvoice,
        row.deliveryStatus,
        row.sharedToProject ? "shared" : "pending",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query, rows]);

  return (
    <div className="space-y-4">
      <ProcurementPageHeader
        title="Installation"
        actions={
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
        }
      />

      <p className="text-sm text-muted-foreground">
        Open a row, fill site installation details, then share to the Project module from the
        detail page. Sharing is not done from this list.
      </p>

      <ProcurementListSearch
        value={query}
        onChange={setQuery}
        placeholder="Search company PO, customer, challan / invoice…"
        aria-label="Search installation queue"
      />

      <div className={procurementUi.tableShell}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Company PO number</th>
                <th className="px-3 py-2 text-left font-medium">Customer name</th>
                <th className="px-3 py-2 text-left font-medium">Customer PO number</th>
                <th className="px-3 py-2 text-left font-medium">Delivered date</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Challan / invoice number</th>
                <th className="px-3 py-2 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                      <Wrench className="size-5 text-muted-foreground/70" aria-hidden />
                      <p>
                        No installation items yet. Finalize delivery on Delivery Status and tick{" "}
                        <span className="font-medium text-foreground">Requires installation</span>.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.challanId}
                    className="border-b border-border/70 transition-colors duration-200 hover:bg-muted/40"
                  >
                    <td className="px-3 py-2 font-medium tabular-nums">{row.companyPoNumber}</td>
                    <td className="px-3 py-2">{row.customerName}</td>
                    <td className="px-3 py-2 tabular-nums">{row.customerPoNumber}</td>
                    <td className="px-3 py-2 tabular-nums">{row.deliveredDate}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge
                          variant={shipmentStatusBadgeVariant(row.deliveryStatus)}
                          className={procurementUi.statusBadge}
                        >
                          {row.deliveryStatus}
                        </Badge>
                        <Badge
                          variant={row.sharedToProject ? "secondary" : "outline"}
                          className={procurementUi.statusBadge}
                        >
                          {row.sharedToProject ? "Shared" : "Pending share"}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.challanOrInvoice}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={installationDetailHref(row.challanId)}
                        className={cn(
                          buttonVariants({ size: "sm", variant: "ghost" }),
                          procurementUi.actionBtn,
                          "cursor-pointer text-[#0369A1] hover:text-[#0369A1]",
                        )}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
