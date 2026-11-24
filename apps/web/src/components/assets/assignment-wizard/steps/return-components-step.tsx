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
    <div className="grid max-w-lg gap-3" data-testid="return-components-step">
      <p className="text-sm text-muted-foreground">Mark each component as returned or missing.</p>
      <ul className="m-0 list-none space-y-3 p-0">
        {state.componentReturns.map((line) => (
          <li
            key={line.componentId}
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors duration-200",
            )}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{line.label}</div>
              <div className="text-xs text-muted-foreground">
                S/N: {line.serialNumber || "—"}
              </div>
            </div>
            <label className="sr-only" htmlFor={`component-outcome-${line.componentId}`}>
              Outcome for {line.label}
            </label>
            <select
              id={`component-outcome-${line.componentId}`}
              aria-label={`Outcome for ${line.label}`}
              data-testid={`component-outcome-${line.componentId}`}
              className="h-9 w-[8.5rem] shrink-0 cursor-pointer rounded-md border border-input bg-background px-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={line.issueStatus === "MISSING" ? "MISSING" : "RETURNED"}
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
          </li>
        ))}
      </ul>
    </div>
  );
}
