import type { ReturnCondition } from "@/components/assets/assignment-wizard/wizard-types";

/** Reuse assignment return-condition vocabulary for physical condition. */
export const USER_TRANSFER_PHYSICAL_CONDITIONS: Array<{
  value: ReturnCondition;
  label: string;
  description: string;
}> = [
  {
    value: "good",
    label: "Good",
    description: "Asset is in working order for the next lifecycle step.",
  },
  {
    value: "outdated",
    label: "Outdated",
    description: "Asset is outdated / should not be re-issued as-is.",
  },
  {
    value: "dead",
    label: "Not working",
    description: "Asset is non-functional / pending disposal path.",
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
