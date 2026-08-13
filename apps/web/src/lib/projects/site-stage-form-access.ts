import type { Project, SiteInstallation } from "@/services/projects-portal-service";
import { progressAllowsNextStageAssignment } from "@/components/projects/site-stage-assignments";
import { siteWorkflowStageLabel } from "@/components/projects/projects-domain";

export type SiteStageFormKey =
  | "assignment"
  | "survey"
  | "scm"
  | "onsite"
  | "installation"
  | "acceptance";

const ASSIGNABLE_STAGES = [
  "survey",
  "scm",
  "onsite",
  "installation",
  "acceptance",
] as const;

const ASSIGNEE_FIELD: Record<
  Exclude<SiteStageFormKey, "assignment">,
  keyof SiteInstallation
> = {
  survey: "survey_assignee_employee_id",
  scm: "scm_assignee_employee_id",
  onsite: "onsite_assignee_employee_id",
  installation: "installation_assignee_employee_id",
  acceptance: "acceptance_assignee_employee_id",
};

const PROGRESS_FIELD: Record<
  (typeof ASSIGNABLE_STAGES)[number],
  keyof SiteInstallation
> = {
  survey: "survey_progress_status",
  scm: "scm_progress_status",
  onsite: "onsite_progress_status",
  installation: "installation_progress_status",
  acceptance: "acceptance_progress_status",
};

export function normalizeWorkflowStage(stage: string): string {
  return stage === "configuration" ? "installation" : stage;
}

export function isSiteWorkflowTerminal(site: SiteInstallation): boolean {
  return site.workflow_stage === "completed" || site.status === "completed";
}

/** True when the step owner marked Partial completed or Completed. */
export function isStageProgressDone(
  site: SiteInstallation,
  stage: (typeof ASSIGNABLE_STAGES)[number],
): boolean {
  const status = site[PROGRESS_FIELD[stage]];
  return progressAllowsNextStageAssignment(
    typeof status === "string" ? status : null,
  );
}

/** True when every prior assignable stage has Partial completed or Completed progress. */
export function isStageUnlockedByProgress(
  site: SiteInstallation,
  formStage: Exclude<SiteStageFormKey, "assignment">,
): boolean {
  const idx = ASSIGNABLE_STAGES.indexOf(formStage);
  if (idx < 0) return false;
  if (idx === 0) return true;
  for (let i = 0; i < idx; i++) {
    if (!isStageProgressDone(site, ASSIGNABLE_STAGES[i])) return false;
  }
  return true;
}

export function isStageWorkDone(
  progressStatus: string | null | undefined,
  workStatus: string,
): boolean {
  return progressAllowsNextStageAssignment(progressStatus) || workStatus === "done";
}

/** Project admin may open a step form (read-only) when it has progress or is reachable. */
export function canAdminViewStageForm(
  site: SiteInstallation,
  formStage: SiteStageFormKey,
  progressStatus?: string | null,
  workStatus = "",
): boolean {
  if (formStage === "assignment") return false;

  const stageProgress =
    progressStatus ??
    (formStage !== "assignment"
      ? (site[PROGRESS_FIELD[formStage as (typeof ASSIGNABLE_STAGES)[number]]] as
        | string
        | null
        | undefined)
      : null);

  if (isStageWorkDone(stageProgress, workStatus)) return true;

  if (isSiteWorkflowTerminal(site)) {
    const field = ASSIGNEE_FIELD[formStage];
    const assigneeId = site[field];
    if (typeof assigneeId === "string" && assigneeId.trim()) return true;
    const progressField = PROGRESS_FIELD[formStage as (typeof ASSIGNABLE_STAGES)[number]];
    const savedProgress = site[progressField];
    if (typeof savedProgress === "string" && savedProgress.trim()) return true;
    return false;
  }

  const current = normalizeWorkflowStage(site.workflow_stage);
  if (formStage === "installation") {
    if (current === "installation" || current === "configuration") return true;
  } else if (current === formStage) {
    return true;
  }

  return isStageUnlockedByProgress(site, formStage);
}

/** True when the site's active workflow has reached this assigned step. */
export function isAssignedStepActive(assignedStage: string, workflowStage: string): boolean {
  const current = normalizeWorkflowStage(workflowStage);
  const assigned = normalizeWorkflowStage(assignedStage);
  if (assigned === "assignment") {
    return current === "intake" || current === "assignment";
  }
  if (current === "completed") return false;
  return current === assigned;
}

/** Assignee may open this step — active workflow stage or pre-assigned after prior progress. */
export function canOpenAssignedStageForm(
  site: SiteInstallation,
  assignedStage: Exclude<SiteStageFormKey, "assignment">,
  workflowStage: string,
): boolean {
  if (isAssignedStepActive(assignedStage, workflowStage)) return true;
  return isStageUnlockedByProgress(site, assignedStage);
}

export function workflowStageNotCompleteMessage(
  site: SiteInstallation,
  assignedStage: Exclude<SiteStageFormKey, "assignment">,
): string {
  const idx = ASSIGNABLE_STAGES.indexOf(assignedStage);
  if (idx > 0) {
    const prev = ASSIGNABLE_STAGES[idx - 1];
    const prevLabel = siteWorkflowStageLabel(prev);
    return `${prevLabel} must be Partial completed or Completed before you can open this step.`;
  }
  const label = siteWorkflowStageLabel(normalizeWorkflowStage(site.workflow_stage));
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
  void project;
  void isProjectModuleAdmin;
  if (!sessionEmployeeId && formStage !== "assignment") return false;
  if (site.status === "completed" || site.workflow_stage === "completed") return false;

  const current = normalizeWorkflowStage(site.workflow_stage);

  if (formStage === "assignment") {
    if (current !== "intake" && current !== "assignment") return false;
    return isProjectModuleAdmin;
  }

  const field = ASSIGNEE_FIELD[formStage];
  const assigneeId = site[field];
  if (!assigneeId || typeof assigneeId !== "string") return false;
  if (assigneeId !== sessionEmployeeId) return false;

  if (formStage === "installation") {
    if (current === "installation" || current === "configuration") return true;
  } else if (current === formStage) {
    return true;
  }

  return isStageUnlockedByProgress(site, formStage);
}

export function canOpenCurrentStageForm(
  project: Project,
  site: SiteInstallation,
  sessionEmployeeId: string | null | undefined,
  isProjectModuleAdmin = false,
): boolean {
  const current = normalizeWorkflowStage(site.workflow_stage);
  if (current === "intake" || current === "completed" || current === "assignment") {
    return false;
  }
  if (
    current === "survey" ||
    current === "scm" ||
    current === "onsite" ||
    current === "installation" ||
    current === "acceptance"
  ) {
    if (canEditSiteStageForm(project, site, current, sessionEmployeeId, isProjectModuleAdmin)) {
      return true;
    }
  }

  for (const stage of ASSIGNABLE_STAGES) {
    if (
      isAssigneeForStage(site, stage, sessionEmployeeId) &&
      canOpenAssignedStageForm(site, stage, site.workflow_stage) &&
      !isStageProgressDone(site, stage)
    ) {
      return true;
    }
  }
  return false;
}
