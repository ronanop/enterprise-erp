"use client";

import type { ReturnWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import type { ReturnSummaryView } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import { MOCK_RETURN_SUMMARY } from "@/components/assets/assignment-wizard/wizard-mock-data";

const CONDITION_LABELS: Record<ReturnWizardState["returnCondition"], string> = {
  good: "Good — Return To Stock",
  outdated: "Outdated — Send to Disposal",
  dead: "Not working — pending disposal",
};

export type ReturnReviewStepProps = {
  state: ReturnWizardState;
  summary?: ReturnSummaryView;
  /** Kept for wizard API compatibility; remarks are not collected on this step. */
  onChange?: (patch: Partial<ReturnWizardState>) => void;
};

export function ReturnReviewStep({
  state,
  summary = MOCK_RETURN_SUMMARY,
}: ReturnReviewStepProps) {
  return (
    <div className="grid max-w-2xl gap-5">
      <dl className="overflow-hidden rounded-xl border border-border/70 bg-muted/15 text-sm">
        <div className="grid gap-1 border-b border-border/60 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Asset</dt>
          <dd className="font-medium text-foreground">
            {summary.assetCode} · {summary.assetName}
          </dd>
        </div>
        <div className="grid gap-1 border-b border-border/60 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Assignment
          </dt>
          <dd className="font-mono text-xs text-foreground">{summary.documentNumber}</dd>
        </div>
        <div className="grid gap-1 border-b border-border/60 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Condition
          </dt>
          <dd className="font-medium text-foreground">{CONDITION_LABELS[state.returnCondition]}</dd>
        </div>
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Components
          </dt>
          <dd className="text-foreground">
            {!(state.componentReturns ?? []).length ? (
              "—"
            ) : (
              <ul className="mt-0 list-none space-y-1 p-0">
                {(state.componentReturns ?? []).map((line) => (
                  <li key={line.componentId} className="text-xs">
                    {line.label} ({line.serialNumber}) — {line.issueStatus}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>

      <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
        {state.returnCondition === "outdated"
          ? "Confirming will return the assignment, mark the asset Disposed, and add it to Disposal."
          : "Confirming will return the assignment and update operational status."}
      </p>
    </div>
  );
}
