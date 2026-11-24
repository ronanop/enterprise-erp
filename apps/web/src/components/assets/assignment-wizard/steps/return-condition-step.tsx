"use client";

import type { ReturnCondition, ReturnWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import { cn } from "@/lib/utils";

const OPTIONS: {
  value: ReturnCondition;
  title: string;
}[] = [
  {
    value: "good",
    title: "Good — Return To Stock",
  },
  {
    value: "outdated",
    title: "Outdated — Send to Disposal",
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
                "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors duration-200",
                checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30",
              )}
            >
              <input
                type="radio"
                name="return-condition"
                className="size-4 cursor-pointer"
                checked={checked}
                onChange={() => onChange({ returnCondition: opt.value })}
              />
              <span className="text-sm font-medium text-foreground">{opt.title}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
