import type { AssetDetailDrawerHistoryEntry } from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { EmptyState } from "@/components/assets/shared";
import { cn } from "@/lib/utils";

export type AssignmentHistorySectionProps = {
  history?: AssetDetailDrawerHistoryEntry[] | null;
  className?: string;
};

export function AssignmentHistorySection({ history, className }: AssignmentHistorySectionProps) {
  const rows = history ?? [];

  return (
    <section
      aria-labelledby="drawer-history-heading"
      className={cn("space-y-3", className)}
      data-testid="drawer-assignment-history"
    >
      <h3 id="drawer-history-heading" className="text-sm font-medium tracking-tight text-foreground">
        Assignment history
      </h3>
      {rows.length === 0 ? (
        <EmptyState
          variant="no-queue"
          compact
          title="No assignment history"
          description="Prior issues and returns will appear here."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((entry) => (
            <li
              key={entry.id || `${entry.documentNumber}-${entry.status}`}
              className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm"
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
              <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd>
                    {entry.deliveryReferenceNumber}
                    {entry.deliveryReferenceStatus !== "—"
                      ? ` (${entry.deliveryReferenceStatus})`
                      : ""}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Assignment remarks</dt>
                  <dd className="whitespace-pre-wrap">{entry.assignmentRemarks}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Return remarks</dt>
                  <dd className="whitespace-pre-wrap" data-testid="history-return-remarks">
                    {entry.returnRemarks}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
