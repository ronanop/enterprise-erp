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

function documentsReadyForApproval(
  caseRow: Pick<OnboardingCase, "portal">,
): boolean {
  // BG-check files are display-only here; approval gates on onboarding portal uploads.
  const docs = (caseRow.portal.documents ?? []).filter((d) => d.source !== "bg_check");
  if (!docs.length) return false;
  if (docs.some((d) => d.verifyStatus === "pending" || d.verifyStatus === "rejected")) {
    return false;
  }
  return docs.every(
    (d) => d.verifyStatus === "verified" || d.verifyStatus === "accepted",
  );
}

/**
 * Approve → Ready to Join. Allow after portal submit, or when every uploaded
 * document is verified (covers cases stuck in in_progress after HR verify).
 */
export function canApproveOnboardingCase(
  caseRow: Pick<OnboardingCase, "status" | "portal">,
): boolean {
  if (
    !["in_progress", "submitted", "hr_review", "overdue"].includes(caseRow.status)
  ) {
    return false;
  }
  return isCandidateSubmitted(caseRow) || documentsReadyForApproval(caseRow);
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
