import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";

export type MissingAssignmentField = {
  id: string;
  label: string;
};

export function listMissingAssignmentFields(state: AssignmentWizardState): MissingAssignmentField[] {
  const missing: MissingAssignmentField[] = [];
  if (state.allocationType === "employee") {
    if (state.employeeSource === "MANUAL_ENTRY") {
      if (!state.manualEmployeeName.trim()) missing.push({ id: "name", label: "Employee name" });
      if (!state.manualEmployeePhone.trim()) missing.push({ id: "phone", label: "Employee phone" });
      if (!state.manualEmployeeDeployedTo.trim()) {
        missing.push({ id: "deployed-to", label: "Deployed to" });
      }
    } else if (!state.employeeId) {
      missing.push({ id: "employee", label: "Employee" });
    }
  }
  if (state.allocationType === "department" && !state.departmentId) {
    missing.push({ id: "department", label: "Department" });
  }
  if (state.allocationType === "project" && !state.projectId) {
    missing.push({ id: "project", label: "Project" });
  }
  if (!state.assetId) missing.push({ id: "asset", label: "Asset" });
  if (state.deliveryReferenceStatus === "issued" || state.deliveryReferenceStatus === "received") {
    if (!state.deliveryReferenceNumber.trim()) {
      missing.push({ id: "delivery-number", label: "Delivery reference number" });
    }
  }
  return missing;
}

/** Legacy step helper — Issue Asset is no longer gated per step. */
export function validateAssignmentStep(
  stepIndex: number,
  state: AssignmentWizardState,
): string | null {
  const missing = listMissingAssignmentFields(state);
  switch (stepIndex) {
    case 0: {
      const identity = missing.find((m) =>
        ["employee", "name", "phone", "deployed-to", "department", "project"].includes(m.id),
      );
      return identity ? `${identity.label} is required.` : null;
    }
    case 1:
      return missing.some((m) => m.id === "asset") ? "Select an asset to continue." : null;
    case 2:
      return null;
    case 3: {
      const delivery = missing.find((m) => m.id === "delivery-number");
      return delivery
        ? "Delivery reference number is required for Issued or Received status."
        : null;
    }
    case 4:
      return null;
    default:
      return null;
  }
}

export function validateReturnStep(stepIndex: number): string | null {
  if (stepIndex === 1) {
    return null;
  }
  return null;
}
