"use client";

import { EmptyState } from "@/components/assets/shared";
import type { WizardIssuedItemOption } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import { MOCK_ISSUED_ITEMS } from "@/components/assets/assignment-wizard/wizard-mock-data";
import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import { cn } from "@/lib/utils";

export type IssuedItemsStepProps = {
  state: AssignmentWizardState;
  onChange: (patch: Partial<AssignmentWizardState>) => void;
  items?: WizardIssuedItemOption[];
};

export function IssuedItemsStep({ state, onChange, items = MOCK_ISSUED_ITEMS }: IssuedItemsStepProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        variant="no-results"
        title="No registered accessories"
        description="Register components on the asset record first."
        compact
      />
    );
  }

  function toggle(id: string, disabled?: boolean) {
    if (disabled) return;
    const set = new Set(state.issuedItemIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ issuedItemIds: [...set] });
  }

  return (
    <div className="grid max-w-lg gap-3">
      <p className="text-sm text-muted-foreground">
        Select accessories you are issuing with this assignment.
      </p>
      <ul className="m-0 list-none space-y-2 p-0">
        {items.map((item) => {
          const checked = state.issuedItemIds.includes(item.id);
          const disabled = Boolean(item.disabled);
          return (
            <li key={item.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors duration-200",
                  disabled && "cursor-not-allowed opacity-60",
                  checked ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/30",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(item.id, disabled)}
                />
                <span className="flex-1 text-sm">
                  <span className="font-medium">{item.label}</span>
                  {item.componentName ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {item.componentName}
                    </span>
                  ) : null}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    S/N: {item.serialNumber?.trim() || "—"}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {disabled ? "Currently issued" : `Status: ${item.status}`}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
