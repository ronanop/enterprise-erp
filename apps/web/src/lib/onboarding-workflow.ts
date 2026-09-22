import type { OnboardingCase, OnboardingCaseStatus } from "@/types/onboarding-management";

/** Statuses where HR can review and act after the candidate has submitted. */
export const HR_ACTION_STATUSES: OnboardingCaseStatus[] = [
  "submitted",
  "hr_review",
  "overdue",
  "ready_to_join",
  "pending_join",
];

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isJoiningDateReached(
  joiningDate?: string | null,
  today = todayIso(),
): boolean {
  if (!joiningDate) return true;
  return joiningDate <= today;
}

export function isCandidateSubmitted(caseRow: Pick<OnboardingCase, "portal">): boolean {
  return Boolean(caseRow.portal.submittedAt);
}

export function canApproveOnboardingCase(
  caseRow: Pick<OnboardingCase, "status" | "portal">,
): boolean {
  return (
    isCandidateSubmitted(caseRow) &&
    ["hr_review", "overdue"].includes(caseRow.status)
  );
}

/** Create employee profile after HR approval. */
export function canCompleteOnboardingCase(caseRow: Pick<OnboardingCase, "status">): boolean {
  return caseRow.status === "ready_to_join";
}

/** Move pending employee to active/probation on or after joining date. */
export function canActivateOnboardingCase(
  caseRow: Pick<OnboardingCase, "status" | "joiningDate">,
  today = todayIso(),
): boolean {
  return caseRow.status === "pending_join" && isJoiningDateReached(caseRow.joiningDate, today);
}

export function canActivateOnboardingCaseEarly(
  caseRow: Pick<OnboardingCase, "status">,
): boolean {
  return caseRow.status === "pending_join";
}

export function isPortalInProgressStatus(status: OnboardingCaseStatus): boolean {
  return [
    "in_progress",
    "submitted",
    "hr_review",
    "overdue",
    "ready_to_join",
    "pending_join",
    "joined",
  ].includes(status);
}

export function hasOnboardingEmployeeRecord(caseRow: Pick<OnboardingCase, "status" | "employeeId">): boolean {
  return Boolean(caseRow.employeeId) && ["pending_join", "joined"].includes(caseRow.status);
}
