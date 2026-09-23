import type { AssetDetailDrawerHistoryEntry } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { cn } from "@/lib/utils";

import { DrawerEmptyLine, DrawerSectionCard } from "./drawer-section";

export type AssignmentHistorySectionProps = {
  history?: AssetDetailDrawerHistoryEntry[] | null;
  className?: string;
};

export function AssignmentHistorySection({ history, className }: AssignmentHistorySectionProps) {
  const rows = history ?? [];

  return (
    <DrawerSectionCard
      title="Assignment history"
      headingId="drawer-history-heading"
      className={cn(className)}
      testId="drawer-assignment-history"
    >
      {rows.length === 0 ? (
        <DrawerEmptyLine>No assignment history</DrawerEmptyLine>
      ) : (
        <ul className="space-y-3">
          {rows.map((entry) => (
            <li
              key={entry.id || `${entry.documentNumber}-${entry.status}`}
              className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-foreground">{entry.assigneeLabel}</p>
                <p className="font-mono text-xs text-muted-foreground">{entry.documentNumber}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {entry.status}
                {entry.allocatedAt !== "—" ? ` · Issued ${entry.allocatedAt}` : ""}
                {entry.returnedAt !== "—" ? ` · Returned ${entry.returnedAt}` : ""}
              </p>
              <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-2 text-xs">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Delivery Challan</dt>
                  <dd className="mt-0.5 break-words" data-testid="drawer-history-delivery">
                    {entry.deliveryChallanSummary ||
                      `${entry.deliveryReferenceNumber}${
                        entry.deliveryReferenceStatus !== "—"
                          ? ` (${entry.deliveryReferenceStatus})`
                          : ""
                      }`}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Assignment remarks</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{entry.assignmentRemarks}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Return remarks</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap" data-testid="history-return-remarks">
                    {entry.returnRemarks}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </DrawerSectionCard>
  );
}
