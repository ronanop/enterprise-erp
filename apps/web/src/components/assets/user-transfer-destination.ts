export type UserTransferDestinationMode = "assign" | "return" | null;

/** Mirrors assignment wizard EmployeeSource for New User identity. */
export type UserTransferEmployeeSource = "MASTER_DATA" | "MANUAL_ENTRY";

export type UserTransferAssignFormState = {
  employeeSource: UserTransferEmployeeSource;
  employeeId: string;
  manualEmployeeName: string;
  manualEmployeePhone: string;
  manualEmployeeEmail: string;
  manualEmployeeDeployedTo: string;
  departmentId: string;
  toLocationId: string;
  toBuildingId: string;
  allocatedAt: string;
  assignmentRemarks: string;
};

export type UserTransferReturnFormState = {
  reason: string;
  remarks: string;
};

export const EMPTY_USER_TRANSFER_ASSIGN: UserTransferAssignFormState = {
  employeeSource: "MASTER_DATA",
  employeeId: "",
  manualEmployeeName: "",
  manualEmployeePhone: "",
  manualEmployeeEmail: "",
  manualEmployeeDeployedTo: "",
  departmentId: "",
  toLocationId: "",
  toBuildingId: "",
  allocatedAt: new Date().toISOString().slice(0, 10),
  assignmentRemarks: "",
};

export const EMPTY_USER_TRANSFER_RETURN: UserTransferReturnFormState = {
  reason: "",
  remarks: "",
};

export function isUserTransferAssignComplete(state: UserTransferAssignFormState): boolean {
  if (!state.toLocationId.trim() || !state.toBuildingId.trim()) return false;
  if (!state.allocatedAt.trim()) return false;
  if (state.employeeSource === "MANUAL_ENTRY") {
    if (!state.manualEmployeeName.trim()) return false;
    if (!state.manualEmployeePhone.trim()) return false;
    if (!state.manualEmployeeDeployedTo.trim()) return false;
    if (!state.departmentId.trim()) return false;
    return true;
  }
  if (!state.employeeId.trim()) return false;
  return true;
}

export function isUserTransferReturnComplete(state: UserTransferReturnFormState): boolean {
  return Boolean(state.reason.trim());
}
