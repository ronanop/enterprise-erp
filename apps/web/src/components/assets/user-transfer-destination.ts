export type UserTransferDestinationMode = "assign" | "return" | null;

export type UserTransferAssignFormState = {
  employeeId: string;
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
  employeeId: "",
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
  if (!state.employeeId.trim()) return false;
  if (!state.toLocationId.trim() || !state.toBuildingId.trim()) return false;
  if (!state.allocatedAt.trim()) return false;
  return true;
}

export function isUserTransferReturnComplete(state: UserTransferReturnFormState): boolean {
  return Boolean(state.reason.trim());
}
