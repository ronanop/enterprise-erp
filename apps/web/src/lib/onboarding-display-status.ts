import type { OnboardingCaseStatus } from "@/types/onboarding-management";
import { ONBOARDING_STATUS_LABELS } from "@/types/onboarding-management";

/** Before joining date, surface Ready to Join for in-flight candidates. */
export function resolveOnboardingDisplayStatus(
  status: OnboardingCaseStatus,
  joiningDate?: string | null,
  today = new Date(),
): string {
  if (status === "cancelled" || status === "joined") {
    return ONBOARDING_STATUS_LABELS[status];
  }
  if (status === "pending_join") {
    return ONBOARDING_STATUS_LABELS.pending_join;
  }
  if (joiningDate) {
    const join = new Date(joiningDate);
    if (!Number.isNaN(join.getTime()) && join > today) {
      return ONBOARDING_STATUS_LABELS.ready_to_join;
    }
  }
  if (status === "ready_to_join") {
    return ONBOARDING_STATUS_LABELS.ready_to_join;
  }
  return ONBOARDING_STATUS_LABELS[status] ?? status;
}
