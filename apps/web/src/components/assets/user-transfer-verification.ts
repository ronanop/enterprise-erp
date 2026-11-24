import type { ReturnCondition } from "@/components/assets/assignment-wizard/wizard-types";

/** Pre-transfer physical condition — working / outdated only (no disposal path here). */
export const USER_TRANSFER_PHYSICAL_CONDITIONS: Array<{
  value: Extract<ReturnCondition, "good" | "outdated">;
  label: string;
  description: string;
}> = [
  {
    value: "good",
    label: "Good",
    description: "Ready for the next custody step.",
  },
  {
    value: "outdated",
    label: "Outdated",
    description: "Should not be re-issued as-is.",
  },
];

export type UserTransferVerificationFormState = {
  dataBackupVerified: boolean;
  qcCompleted: boolean;
  qcRemarks: string;
  physicalCondition: ReturnCondition | "";
  verifiedComponentIds: string[];
};

export const EMPTY_USER_TRANSFER_VERIFICATION: UserTransferVerificationFormState = {
  dataBackupVerified: false,
  qcCompleted: false,
  qcRemarks: "",
  physicalCondition: "",
  verifiedComponentIds: [],
};

export function isUserTransferVerificationComplete(
  state: UserTransferVerificationFormState,
  issuedComponentIds: readonly string[],
): boolean {
  if (!state.dataBackupVerified) return false;
  if (!state.qcCompleted) return false;
  if (!state.physicalCondition) return false;
  if (state.physicalCondition === "dead") return false;
  if (issuedComponentIds.length === 0) return true;
  const verified = new Set(state.verifiedComponentIds);
  return issuedComponentIds.every((id) => verified.has(id));
}

export function toggleVerifiedComponent(
  current: readonly string[],
  componentId: string,
  checked: boolean,
): string[] {
  const set = new Set(current);
  if (checked) set.add(componentId);
  else set.delete(componentId);
  return Array.from(set);
}
