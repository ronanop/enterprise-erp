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

function employeeSummary(state: AssignmentWizardState, employees: WizardSelectOption[]) {
  if (state.allocationType !== "employee") {
    return state.allocationType;
  }
  if (state.employeeSource === "MANUAL_ENTRY") {
    const name = state.manualEmployeeName.trim() || "—";
    const deployed = state.manualEmployeeDeployedTo.trim();
    return deployed ? `${name} (deployed to ${deployed})` : `${name} (manual entry)`;
  }
  return labelFor(state.employeeId, employees);
}

function dcModeLabel(mode: AssignmentWizardState["dcChallanMode"]) {
  if (mode === "create_now") return "Create DC now";
  return "Handle later";
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border/60 px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-baseline sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function AssignmentReviewStep({
  state,
  employees = MOCK_EMPLOYEES,
  assets = MOCK_ASSETS,
  issuedItems = MOCK_ISSUED_ITEMS,
}: AssignmentReviewStepProps) {
  const issuedLabels = issuedItems.filter((i) => state.issuedItemIds.includes(i.id)).map((i) => i.label);
  const dcNumber = state.deliveryReferenceNumber.trim();

  return (
    <div className="w-full max-w-2xl">
      <dl className="overflow-hidden rounded-xl border border-border/70 bg-muted/15">
        <ReviewRow label="Employee" value={employeeSummary(state, employees)} />
        <ReviewRow label="Asset" value={labelFor(state.assetId, assets)} />
        {issuedLabels.length ? (
          <ReviewRow label="Issued items" value={issuedLabels.join(", ")} />
        ) : null}
        <ReviewRow label="DC paperwork" value={dcModeLabel(state.dcChallanMode)} />
        {dcNumber ? <ReviewRow label="DC Number" value={dcNumber} /> : null}
      </dl>
    </div>
  );
}
