"use client";

import type { ReturnWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import type { ReturnSummaryView } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import { MOCK_RETURN_SUMMARY } from "@/components/assets/assignment-wizard/wizard-mock-data";

const CONDITION_LABELS: Record<ReturnWizardState["returnCondition"], string> = {
  good: "Good — return to stock",
  outdated: "Outdated — retire",
  dead: "Not working — pending disposal",
};

export type ReturnReviewStepProps = {
  state: ReturnWizardState;
  summary?: ReturnSummaryView;
};

export function ReturnReviewStep({ state, summary = MOCK_RETURN_SUMMARY }: ReturnReviewStepProps) {
  return (
    <div className="grid gap-4">
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
        <div>
          <dt className="text-xs text-muted-foreground">Components</dt>
          <dd>
            {!(state.componentReturns ?? []).length ? (
              "—"
            ) : (
              <ul className="mt-1 list-none space-y-1 p-0">
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
        Confirming will return the assignment and update operational status.
      </p>
    </div>
  );
}
