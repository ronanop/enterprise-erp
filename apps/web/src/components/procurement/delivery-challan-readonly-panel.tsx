"use client";

import { procurementUi } from "@/components/procurement/procurement-ui";
import { cn } from "@/lib/utils";
import {
  formatChallanGrnSummary,
  formatDeliveryModeLabel,
  type DeliveryChallanLine,
  type DeliveryChallanRecord,
} from "@/utils/delivery-challan-storage";

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium text-foreground">{value.trim() || "—"}</div>
    </div>
  );
}

function ChallanLinesTable({ lines }: { lines: DeliveryChallanLine[] }) {
  const rows = lines.filter((line) => line.itemName.trim() || line.product.trim());

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No line items recorded on this challan.</p>
    );
  }

  return (
    <div className={procurementUi.tableShell}>
      <div className={procurementUi.tableScroll}>
        <table className={cn(procurementUi.table, "min-w-[720px]")}>
          <thead className={procurementUi.thead}>
            <tr>
              <th className={cn(procurementUi.th, "w-12")}>S.No</th>
              <th className={cn(procurementUi.th, "w-36")}>Product</th>
              <th className={procurementUi.th}>Description</th>
              <th className={cn(procurementUi.th, "w-28")}>HSN / SAC</th>
              <th className={cn(procurementUi.th, "w-24")}>Asset no.</th>
              <th className={cn(procurementUi.th, "w-20 text-right")}>Qty sent</th>
              <th className={cn(procurementUi.th, "w-28 text-right")}>Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((line, index) => (
              <tr key={line.id} className={procurementUi.tr}>
                <td className={cn(procurementUi.tdNumeric, "text-muted-foreground")}>
                  {index + 1}
                </td>
                <td className={procurementUi.tdMuted}>{line.product.trim() || "—"}</td>
                <td className={procurementUi.td}>{line.itemName.trim() || "—"}</td>
                <td className={procurementUi.tdMuted}>{line.hsnSac.trim() || "—"}</td>
                <td className={procurementUi.tdMuted}>{line.assetNo.trim() || "—"}</td>
                <td className={cn(procurementUi.tdNumeric, "text-right font-medium")}>
                  {line.quantitySent.trim() || "—"}
                </td>
                <td className={cn(procurementUi.tdNumeric, "text-right")}>
                  {line.rate.trim() || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type DeliveryChallanReadOnlyPanelProps = {
  challan: DeliveryChallanRecord;
};

export function DeliveryChallanReadOnlyPanel({ challan }: DeliveryChallanReadOnlyPanelProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReadOnlyField label="Challan number" value={challan.challanNumber} />
        <ReadOnlyField label="Challan date" value={challan.challanDate} />
        <ReadOnlyField label="PO number" value={challan.purchaseOrderNumber} />
        <ReadOnlyField label="GRN" value={formatChallanGrnSummary(challan)} />
        <ReadOnlyField label="Customer" value={challan.customerName} />
        <ReadOnlyField label="Vendor" value={challan.vendorName} />
        <ReadOnlyField label="Entity" value={challan.entityName} />
        <ReadOnlyField
          label="Mode of delivery"
          value={formatDeliveryModeLabel(challan.deliveryMode)}
        />
      </div>
      <div className="space-y-2">
        <h3 className={procurementUi.sectionTitle}>Line items</h3>
        <ChallanLinesTable lines={challan.lines} />
      </div>
    </div>
  );
}
