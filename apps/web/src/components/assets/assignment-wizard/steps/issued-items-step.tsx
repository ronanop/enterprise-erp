"use client";

import {
  STANDARD_ISSUED_ACCESSORIES,
  type WizardIssuedItemOption,
} from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import { cn } from "@/lib/utils";

export type IssuedItemsStepProps = {
  state: AssignmentWizardState;
  onChange: (patch: Partial<AssignmentWizardState>) => void;
  items?: WizardIssuedItemOption[];
  readOnly?: boolean;
};

export function IssuedItemsStep({
  state,
  onChange,
  items = STANDARD_ISSUED_ACCESSORIES,
  readOnly,
}: IssuedItemsStepProps) {
  const catalog = items.length > 0 ? items : STANDARD_ISSUED_ACCESSORIES;

  function toggle(id: string) {
    if (readOnly) return;
    const set = new Set(state.issuedItemIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ issuedItemIds: [...set] });
  }

  return (
    <div className="grid max-w-lg gap-3" data-testid="issued-items-section">
      <h3 className="text-sm font-medium tracking-tight">Issued Items</h3>
      <p className="text-sm text-muted-foreground">
        Select accessories issued with this assignment.
      </p>
      <ul className="m-0 list-none space-y-2 p-0">
        {catalog.map((item) => {
          const checked = state.issuedItemIds.includes(item.id);
          return (
            <li key={item.id}>
              <label
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-3 py-2 transition-colors duration-200",
                  readOnly ? "cursor-default" : "cursor-pointer",
                  checked ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/30",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-primary disabled:cursor-not-allowed"
                  checked={checked}
                  disabled={readOnly}
                  onChange={() => toggle(item.id)}
                />
                <span className="flex-1 text-sm font-medium">{item.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
