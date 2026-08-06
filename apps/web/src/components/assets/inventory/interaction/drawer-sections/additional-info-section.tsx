import type { AssetDetailDrawerAdditional } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { cn } from "@/lib/utils";

export type AdditionalInfoSectionProps = {
  additional?: AssetDetailDrawerAdditional | null;
  className?: string;
};

export function AdditionalInfoSection({ additional, className }: AdditionalInfoSectionProps) {
  const info = additional ?? {
    earlierUsedBy: "—",
    deliveryChallan: "—",
    deliveryReferenceStatus: "—",
    remarks: "—",
    assignmentRemarks: "—",
    returnRemarks: "—",
  };

  return (
    <section aria-labelledby="drawer-additional-heading" className={cn("space-y-3", className)}>
      <h3 id="drawer-additional-heading" className="text-sm font-medium tracking-tight text-foreground">
        Register fields
      </h3>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Earlier used by</dt>
          <dd className="mt-0.5 text-sm" data-testid="drawer-earlier-used-by">
            {info.earlierUsedBy}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Delivery reference</dt>
          <dd className="mt-0.5 text-sm">{info.deliveryChallan}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Delivery status</dt>
          <dd className="mt-0.5 text-sm">{info.deliveryReferenceStatus ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Assignment remarks</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-sm">
            {info.assignmentRemarks ?? info.remarks}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Return remarks</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-sm">{info.returnRemarks ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
