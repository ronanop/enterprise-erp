import {
  ASSIGNMENT_WIZARD_STEPS,
  type AssignmentWizardState,
} from "@/components/assets/assignment-wizard/wizard-types";

export function validateAssignmentStepId(
  stepId: string,
  state: AssignmentWizardState,
): string | null {
  switch (stepId) {
    case "employee": {
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
    case "asset":
      return state.assetId ? null : "Select an asset to continue.";
    case "issued-items":
      return null;
    case "delivery": {
      if (state.deliveryReferenceStatus === "issued" || state.deliveryReferenceStatus === "received") {
        if (!state.deliveryReferenceNumber.trim()) {
          return "Delivery reference number is required for Issued or Received status.";
        }
      }
      return null;
    }
    case "review":
      return null;
    default:
      return null;
  }
}

export function validateAssignmentStep(
  stepIndex: number,
  state: AssignmentWizardState,
): string | null {
  const stepId = ASSIGNMENT_WIZARD_STEPS[stepIndex]?.id;
  return stepId ? validateAssignmentStepId(stepId, state) : null;
}

export function validateReturnStep(stepIndex: number): string | null {
  if (stepIndex === 1) {
    return null;
  }
  return null;
}
