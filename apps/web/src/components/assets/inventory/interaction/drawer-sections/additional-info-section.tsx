import type { AssetDetailDrawerAdditional } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { cn } from "@/lib/utils";

import { DrawerKvField, DrawerKvGrid, DrawerSectionCard } from "./drawer-section";

export type AdditionalInfoSectionProps = {
  additional?: AssetDetailDrawerAdditional | null;
  className?: string;
};

export function AdditionalInfoSection({ additional, className }: AdditionalInfoSectionProps) {
  const info = additional ?? {
    earlierUsedBy: "—",
    deliveryChallan: "—",
    deliveryReferenceStatus: "—",
    deliverySignature: "Not Signed",
    deliveryChallanSummary: "—",
    remarks: "—",
    assignmentRemarks: "—",
    returnRemarks: "—",
  };

  return (
    <DrawerSectionCard
      title="Remarks"
      headingId="drawer-additional-heading"
      className={cn(className)}
    >
      <DrawerKvGrid>
        <DrawerKvField
          label="Earlier used by"
          value={info.earlierUsedBy}
          testId="drawer-earlier-used-by"
          span
        />
        <DrawerKvField
          label="Delivery Challan"
          value={
            info.deliveryChallanSummary ??
            `${info.deliveryChallan} · ${info.deliveryReferenceStatus ?? "—"}${
              info.deliverySignature ? ` · ${info.deliverySignature}` : ""
            }`
          }
          testId="drawer-additional-dc"
          span
        />
        <DrawerKvField
          label="Assignment remarks"
          value={info.assignmentRemarks ?? info.remarks}
          pre
          span
        />
        <DrawerKvField label="Return remarks" value={info.returnRemarks ?? "—"} pre span />
      </DrawerKvGrid>
    </DrawerSectionCard>
  );
}
