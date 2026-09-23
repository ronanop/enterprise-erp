"use client";

import { EmptyState } from "@/components/assets/shared";
import type {
  ComponentReturnLineState,
  ComponentReturnOutcome,
  ReturnWizardState,
} from "@/components/assets/assignment-wizard/wizard-types";
import { cn } from "@/lib/utils";

const OUTCOMES: { value: ComponentReturnOutcome; label: string }[] = [
  { value: "RETURNED", label: "Returned" },
  { value: "MISSING", label: "Missing" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "RETAINED", label: "Retained" },
];

export type ReturnComponentsStepProps = {
  state: ReturnWizardState;
  onChange: (patch: Partial<ReturnWizardState>) => void;
};

export function ReturnComponentsStep({ state, onChange }: ReturnComponentsStepProps) {
  if (state.componentReturns.length === 0) {
    return (
      <EmptyState
        variant="no-results"
        title="No issued components"
        description="This assignment has no structured component lines. Continue to return the asset."
        compact
      />
    );
  }

  function updateLine(componentId: string, patch: Partial<ComponentReturnLineState>) {
    onChange({
      componentReturns: state.componentReturns.map((line) =>
        line.componentId === componentId ? { ...line, ...patch } : line,
      ),
    });
  }

  return (
    <div className="grid max-w-lg gap-3">
      <p className="text-sm text-muted-foreground">
        Reconcile each component issued with this assignment.
      </p>
      <ul className="m-0 list-none space-y-3 p-0">
        {state.componentReturns.map((line) => (
          <li
            key={line.componentId}
            className={cn("rounded-lg border border-border px-3 py-2 transition-colors duration-200")}
          >
            <div className="text-sm font-medium">{line.label}</div>
            <div className="text-xs text-muted-foreground">S/N: {line.serialNumber || "—"}</div>
            <label className="mt-2 block text-xs font-medium text-muted-foreground">
              Outcome
              <select
                className="mt-1 flex h-9 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-sm"
                value={line.issueStatus}
                onChange={(e) =>
                  updateLine(line.componentId, {
                    issueStatus: e.target.value as ComponentReturnOutcome,
                  })
                }
              >
                {OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block text-xs font-medium text-muted-foreground">
              Remarks
              <input
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={line.returnRemarks}
                onChange={(e) => updateLine(line.componentId, { returnRemarks: e.target.value })}
                placeholder="Optional"
              />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
