import type { OnboardingCaseStatus } from "@/types/onboarding-management";
import { ONBOARDING_STATUS_LABELS } from "@/types/onboarding-management";

/** Map case status to the label shown in HR UI (do not invent Ready to Join). */
export function resolveOnboardingDisplayStatus(
  status: OnboardingCaseStatus,
  _joiningDate?: string | null,
  _today = new Date(),
): string {
  return ONBOARDING_STATUS_LABELS[status] ?? status;
}
