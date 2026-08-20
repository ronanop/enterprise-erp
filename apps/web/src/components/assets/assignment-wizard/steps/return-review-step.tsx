"use client";

import type { ReturnSummaryView } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import type { ReturnWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import { EmptyState } from "@/components/assets/shared";

const CONDITION_LABELS: Record<ReturnWizardState["returnCondition"], string> = {
  good: "Good — return to stock",
  outdated: "Outdated — retire",
  dead: "Not working — pending disposal",
};

export type ReturnReviewStepProps = {
  state: ReturnWizardState;
  summary?: ReturnSummaryView | null;
};

export function ReturnReviewStep({ state, summary }: ReturnReviewStepProps) {
  if (!summary) {
    return (
      <div data-testid="return-review-empty">
        <EmptyState
          variant="no-results"
          compact
          title="Cannot review return"
          description="Assignment summary is missing. Reload the return wizard from an active assignment."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4" data-testid="return-review-section">
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Asset</dt>
          <dd>
            {summary.assetCode} · {summary.assetName}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Assignment</dt>
          <dd className="font-mono text-xs">{summary.documentNumber}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Condition</dt>
          <dd>{CONDITION_LABELS[state.returnCondition]}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Return remarks</dt>
          <dd>{state.returnRemarks || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Reason</dt>
          <dd>{state.reason || "—"}</dd>
        </div>
      </dl>
      <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
        Confirming will return the assignment and update operational status.
      </p>
    </div>
  );
}
