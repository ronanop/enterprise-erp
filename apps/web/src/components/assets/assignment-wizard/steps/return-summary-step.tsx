"use client";

import type { ReturnSummaryView } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import { EmptyState, StatusBadge } from "@/components/assets/shared";

export type ReturnSummaryStepProps = {
  summary?: ReturnSummaryView | null;
};

export function ReturnSummaryStep({ summary }: ReturnSummaryStepProps) {
  if (!summary) {
    return (
      <div data-testid="return-summary-empty">
        <EmptyState
          variant="no-results"
          compact
          title="Assignment summary unavailable"
          description="Return context could not be loaded. Go back and open return from an active assignment."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4" data-testid="return-summary-section">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{summary.assetCode}</p>
          <p className="text-base font-semibold">{summary.assetName}</p>
          <p className="text-xs text-muted-foreground">SN: {summary.serialNumber}</p>
        </div>
        <StatusBadge kind="operational" status="ASSIGNED" />
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Assignment</dt>
          <dd className="font-mono text-xs">{summary.documentNumber}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Assignee</dt>
          <dd>{summary.assigneeLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Allocated</dt>
          <dd>{summary.allocatedAt}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Delivery ref</dt>
          <dd>{summary.deliveryReferenceNumber}</dd>
        </div>
      </dl>
    </div>
  );
}
