"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Wrench } from "lucide-react";

import {
  ProcurementListSearch,
  ProcurementPageHeader,
} from "@/components/procurement/procurement-page-header";
import { procurementUi } from "@/components/procurement/procurement-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listDeliveryChallans } from "@/utils/delivery-challan-storage";
import {
  deliveryStatusRowFromChallan,
  isDeliveredShipmentStatus,
} from "@/utils/delivery-status-storage";
import { installationDetailHref } from "@/utils/installation-routes";

type InstallationListRow = {
  challanId: string;
  companyPoNumber: string;
  customerName: string;
  customerPoNumber: string;
  deliveredDate: string;
  challanOrInvoice: string;
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
        },
      ];
    } catch {
      return [];
    }
  });
}

export function InstallationListPage() {
  const router = useRouter();
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

      <ProcurementListSearch
        value={query}
        onChange={setQuery}
        placeholder="Search company PO, customer, challan / invoice…"
        aria-label="Search installation queue"
      />

      <div className={procurementUi.tableShell}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Company PO number</th>
                <th className="px-3 py-2 text-left font-medium">Customer name</th>
                <th className="px-3 py-2 text-left font-medium">Customer PO number</th>
                <th className="px-3 py-2 text-left font-medium">Delivered date</th>
                <th className="px-3 py-2 text-left font-medium">Challan / invoice number</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
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
                    role="link"
                    tabIndex={0}
                    className={cn(
                      "cursor-pointer border-b border-border/70 transition-colors duration-200",
                      "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
                    )}
                    onClick={() => router.push(installationDetailHref(row.challanId))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(installationDetailHref(row.challanId));
                      }
                    }}
                  >
                    <td className="px-3 py-2 font-medium tabular-nums">{row.companyPoNumber}</td>
                    <td className="px-3 py-2">{row.customerName}</td>
                    <td className="px-3 py-2 tabular-nums">{row.customerPoNumber}</td>
                    <td className="px-3 py-2 tabular-nums">{row.deliveredDate}</td>
                    <td className="px-3 py-2 tabular-nums">{row.challanOrInvoice}</td>
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
