"use client";

import type { ReturnCondition, ReturnWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import { cn } from "@/lib/utils";

const OPTIONS: {
  value: ReturnCondition;
  title: string;
  description: string;
  tone?: "destructive";
}[] = [
  {
    value: "good",
    title: "Good — return to stock",
    description: "Asset goes to Ready To Move (can be re-issued).",
  },
  {
    value: "outdated",
    title: "Outdated — retire",
    description: "Asset marked Retired (not given to anyone).",
  },
  {
    value: "dead",
    title: "Not working — pending disposal",
    description: "Asset marked Pending disposal.",
    tone: "destructive",
  },
];

export type ReturnConditionStepProps = {
  state: ReturnWizardState;
  onChange: (patch: Partial<ReturnWizardState>) => void;
};

export function ReturnConditionStep({ state, onChange }: ReturnConditionStepProps) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-3 text-sm text-muted-foreground">How is the asset being returned?</legend>
      <div className="grid gap-2" role="radiogroup" aria-label="Return condition">
        {OPTIONS.map((opt) => {
          const checked = state.returnCondition === opt.value;
          return (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border px-3 py-3 transition-colors duration-200",
                checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30",
                opt.tone === "destructive" && checked && "border-destructive/50 bg-destructive/5",
              )}
            >
              <input
                type="radio"
                name="return-condition"
                className="mt-1 size-4 cursor-pointer"
                checked={checked}
                onChange={() => onChange({ returnCondition: opt.value })}
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">{opt.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{opt.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
