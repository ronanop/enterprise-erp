import type { ReadonlyURLSearchParams } from "next/navigation";

import type { AssignmentWizardQuery, ReturnWizardQuery } from "./assignment-wizard-mapper";

export {
  buildAssignmentWizardHref,
  buildIssueWizardHref,
  buildReturnWizardHref,
} from "@/components/assets/navigation/assignment-navigation";

export function parseAssignmentWizardQuery(
  params: ReadonlyURLSearchParams | URLSearchParams,
): AssignmentWizardQuery {
  return {
    assetId: params.get("assetId") ?? params.get("asset_id") ?? undefined,
    draftId: params.get("draftId") ?? params.get("draft_id") ?? undefined,
    employeeId: params.get("employeeId") ?? params.get("employee_id") ?? undefined,
    submit: params.get("submit") === "1" || params.get("submit") === "true",
  };
}

export function parseReturnWizardQuery(
  params: ReadonlyURLSearchParams | URLSearchParams,
): ReturnWizardQuery {
  return {
    assetId: params.get("assetId") ?? params.get("asset_id") ?? undefined,
    assignmentId: params.get("assignmentId") ?? params.get("assignment_id") ?? undefined,
    intent: params.get("intent") ?? undefined,
  };
}
