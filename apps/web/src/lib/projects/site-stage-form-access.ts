import type { Project, SiteInstallation } from "@/services/projects-portal-service";
import { siteWorkflowStageLabel } from "@/components/projects/projects-domain";

export type SiteStageFormKey =
  | "assignment"
  | "survey"
  | "scm"
  | "installation"
  | "acceptance";

const ASSIGNEE_FIELD: Record<
  Exclude<SiteStageFormKey, "assignment">,
  keyof SiteInstallation
> = {
  survey: "survey_assignee_employee_id",
  scm: "scm_assignee_employee_id",
  installation: "installation_assignee_employee_id",
  acceptance: "acceptance_assignee_employee_id",
};

export function normalizeWorkflowStage(stage: string): string {
  return stage === "configuration" ? "installation" : stage;
}

/** True when the site's active workflow has reached this assigned step (may open the form). */
export function isAssignedStepActive(assignedStage: string, workflowStage: string): boolean {
  const current = normalizeWorkflowStage(workflowStage);
  const assigned = normalizeWorkflowStage(assignedStage);
  if (assigned === "assignment") {
    return current === "intake" || current === "assignment";
  }
  if (current === "completed") return false;
  return current === assigned;
}

export function workflowStageNotCompleteMessage(workflowStage: string): string {
  const label = siteWorkflowStageLabel(normalizeWorkflowStage(workflowStage));
  return `${label} is not completed yet. Please complete that step before opening this one.`;
}

export function isAssigneeForStage(
  site: SiteInstallation,
  formStage: SiteStageFormKey,
  sessionEmployeeId: string | null | undefined,
): boolean {
  if (!sessionEmployeeId || formStage === "assignment") return false;
  const field = ASSIGNEE_FIELD[formStage];
  const assigneeId = site[field];
  return typeof assigneeId === "string" && assigneeId === sessionEmployeeId;
}

/** True when the signed-in employee may edit this stage form (not just view project). */
export function canEditSiteStageForm(
  project: Project,
  site: SiteInstallation,
  formStage: SiteStageFormKey,
  sessionEmployeeId: string | null | undefined,
  isProjectModuleAdmin = false,
): boolean {
  if (!sessionEmployeeId && formStage !== "assignment") return false;
  if (site.status === "completed" || site.workflow_stage === "completed") return false;

  const current = normalizeWorkflowStage(site.workflow_stage);

  if (formStage === "assignment") {
    if (current !== "intake" && current !== "assignment") return false;
    return isProjectModuleAdmin;
  }

  if (formStage === "installation") {
    if (current !== "installation" && current !== "configuration") return false;
  } else if (current !== formStage) {
    return false;
  }

  const field = ASSIGNEE_FIELD[formStage];
  const assigneeId = site[field];
  if (!assigneeId || typeof assigneeId !== "string") return false;
  return assigneeId === sessionEmployeeId;
}

export function canOpenCurrentStageForm(
  project: Project,
  site: SiteInstallation,
  sessionEmployeeId: string | null | undefined,
  isProjectModuleAdmin = false,
): boolean {
  const current = normalizeWorkflowStage(site.workflow_stage);
  if (current === "intake" || current === "completed") return false;
  if (current === "assignment") {
    return canEditSiteStageForm(project, site, "assignment", sessionEmployeeId, isProjectModuleAdmin);
  }
  if (
    current === "survey" ||
    current === "scm" ||
    current === "installation" ||
    current === "acceptance"
  ) {
    return canEditSiteStageForm(project, site, current, sessionEmployeeId, isProjectModuleAdmin);
  }
  return false;
}
