import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";

export function validateAssignmentStep(
  stepIndex: number,
  state: AssignmentWizardState,
): string | null {
  switch (stepIndex) {
    case 0: {
      if (state.allocationType === "employee" && !state.employeeId) {
        return "Select an employee to continue.";
      }
      if (state.allocationType === "department" && !state.departmentId) {
        return "Select a department to continue.";
      }
      if (state.allocationType === "project" && !state.projectId) {
        return "Select a project to continue.";
      }
      return null;
    }
    case 1:
      return state.assetId ? null : "Select an asset to continue.";
    case 2:
      return null;
    case 3: {
      if (state.deliveryReferenceStatus === "issued" || state.deliveryReferenceStatus === "received") {
        if (!state.deliveryReferenceNumber.trim()) {
          return "Delivery reference number is required for Issued or Received status.";
        }
      }
      return null;
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
