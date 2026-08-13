"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DeliveryChallanRecord } from "@/utils/delivery-challan-storage";
import { formatChallanGrnSummary } from "@/utils/delivery-challan-storage";

type DeliveryChallanEntityViewDialogProps = {
  open: boolean;
  challan: DeliveryChallanRecord | null;
  onClose: () => void;
};

function DetailBlock({ label, value }: { label: string; value: string }) {
  const text = value.trim();
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("text-sm text-foreground", text.includes("\n") && "whitespace-pre-wrap")}>
        {text || "—"}
      </div>
    </div>
  );
}

export function DeliveryChallanEntityViewDialog({
  open,
  challan,
  onClose,
}: DeliveryChallanEntityViewDialogProps) {
  if (!open || !challan) return null;

  const subtitle = [
    challan.challanNumber,
    challan.purchaseOrderNumber,
    formatChallanGrnSummary(challan),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="challan-entity-view-title"
        className="flex w-full max-w-md flex-col rounded-lg border border-border/80 bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="challan-entity-view-title" className="text-base font-extrabold tracking-tight">
          Entity details
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>

        <div className="mt-4 space-y-4">
          <DetailBlock label="Entity name" value={challan.entityName} />
          <DetailBlock label="Address" value={challan.entityAddressBlock} />
          <DetailBlock label="GST / registration" value={challan.entityGstBlock} />
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            size="sm"
            className="cursor-pointer transition-colors duration-200"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
