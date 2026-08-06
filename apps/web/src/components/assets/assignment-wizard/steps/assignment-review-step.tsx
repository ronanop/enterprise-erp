"use client";

import type { WizardSelectOption } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import {
  MOCK_ASSETS,
  MOCK_EMPLOYEES,
  MOCK_ISSUED_ITEMS,
} from "@/components/assets/assignment-wizard/wizard-mock-data";
import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";

export type AssignmentReviewStepProps = {
  state: AssignmentWizardState;
  employees?: WizardSelectOption[];
  assets?: WizardSelectOption[];
  issuedItems?: WizardSelectOption[];
};

function labelFor(id: string, options: WizardSelectOption[]) {
  return options.find((o) => o.id === id)?.label ?? "—";
}

export function AssignmentReviewStep({
  state,
  employees = MOCK_EMPLOYEES,
  assets = MOCK_ASSETS,
  issuedItems = MOCK_ISSUED_ITEMS,
}: AssignmentReviewStepProps) {
  const issuedLabels = issuedItems.filter((i) => state.issuedItemIds.includes(i.id)).map((i) => i.label);

  return (
    <div className="grid gap-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Employee</dt>
          <dd>{labelFor(state.employeeId, employees)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Asset</dt>
          <dd>{labelFor(state.assetId, assets)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Issued items</dt>
          <dd>{issuedLabels.length ? issuedLabels.join(", ") : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Delivery status</dt>
          <dd className="capitalize">{state.deliveryReferenceStatus}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Delivery reference</dt>
          <dd>{state.deliveryReferenceNumber || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Expected return</dt>
          <dd>{state.expectedReturnAt || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Remarks</dt>
          <dd>{state.assignmentRemarks || "—"}</dd>
        </div>
      </dl>
      <p className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Confirm to save the assignment draft. Use Submit from the assignment list when ready for approval.
      </p>
    </div>
  );
}
