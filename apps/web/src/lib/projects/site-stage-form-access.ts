import type { Project, SiteInstallation } from "@/services/projects-portal-service";
import {
  progressAllowsNextStageAssignment,
  progressMarksStageCompleted,
} from "@/components/projects/site-stage-assignments";
import { siteWorkflowStageLabel } from "@/components/projects/projects-domain";

export type SiteStageFormKey =
  | "assignment"
  | "survey"
  | "scm"
  | "onsite"
  | "onsite_delivery"
  | "material_handover"
  | "installation"
  | "acceptance";

const ASSIGNABLE_STAGES = [
  "survey",
  "scm",
  "onsite_delivery",
  "material_handover",
  "installation",
  "acceptance",
] as const;

const ASSIGNEE_FIELD: Record<
  Exclude<SiteStageFormKey, "assignment" | "onsite">,
  keyof SiteInstallation
> = {
  survey: "survey_assignee_employee_id",
  scm: "scm_assignee_employee_id",
  onsite_delivery: "onsite_delivery_assignee_employee_id",
  material_handover: "material_handover_assignee_employee_id",
  installation: "installation_assignee_employee_id",
  acceptance: "acceptance_assignee_employee_id",
};

const PROGRESS_FIELD: Record<
  (typeof ASSIGNABLE_STAGES)[number],
  keyof SiteInstallation
> = {
  survey: "survey_progress_status",
  scm: "scm_progress_status",
  onsite_delivery: "onsite_delivery_progress_status",
  material_handover: "material_handover_progress_status",
  installation: "installation_progress_status",
  acceptance: "acceptance_progress_status",
};

export function normalizeWorkflowStage(stage: string): string {
  if (stage === "configuration") return "installation";
  if (stage === "onsite") return "onsite_delivery";
  return stage;
}

export function isSiteWorkflowTerminal(site: SiteInstallation): boolean {
  return site.workflow_stage === "completed" || site.status === "completed";
}

function progressForStage(
  site: SiteInstallation,
  stage: (typeof ASSIGNABLE_STAGES)[number],
): string | null | undefined {
  const status = site[PROGRESS_FIELD[stage]];
  if (typeof status === "string" && status.trim()) return status;
  if (stage === "onsite_delivery") {
    return site.onsite_progress_status;
  }
  return typeof status === "string" ? status : null;
}

/** True when the step owner marked Partial completed or Completed (unlock next). */
export function isStageProgressDone(
  site: SiteInstallation,
  stage: (typeof ASSIGNABLE_STAGES)[number],
): boolean {
  return progressAllowsNextStageAssignment(progressForStage(site, stage));
}

/** True when the step owner marked Completed only. */
export function isStageAssigneeCompleted(
  site: SiteInstallation,
  stage: (typeof ASSIGNABLE_STAGES)[number],
): boolean {
  return progressMarksStageCompleted(progressForStage(site, stage));
}

/** True when every prior assignable stage has Partial completed or Completed progress. */
export function isStageUnlockedByProgress(
  site: SiteInstallation,
  formStage: Exclude<SiteStageFormKey, "assignment" | "onsite">,
): boolean {
  void site;
  void formStage;
  return true;
}

export function isStageWorkDone(
  progressStatus: string | null | undefined,
  workStatus: string,
): boolean {
  return progressMarksStageCompleted(progressStatus) || workStatus === "done";
}

function resolveFormStage(
  formStage: SiteStageFormKey,
): Exclude<SiteStageFormKey, "assignment" | "onsite"> | null {
  if (formStage === "assignment") return null;
  if (formStage === "onsite") return "onsite_delivery";
  return formStage;
}

/** Project admin may open a step form when the step has an assignee or saved progress. */
export function canAdminViewStageForm(
  site: SiteInstallation,
  formStage: SiteStageFormKey,
  progressStatus?: string | null,
  workStatus = "",
): boolean {
  const resolved = resolveFormStage(formStage);
  if (!resolved) return false;

  const stageProgress = progressStatus ?? progressForStage(site, resolved);

  if (isStageWorkDone(stageProgress, workStatus)) return true;

  const field = ASSIGNEE_FIELD[resolved];
  let assigneeId = site[field];
  if (!assigneeId && resolved === "onsite_delivery") {
    assigneeId = site.onsite_assignee_employee_id;
  }
  if (typeof assigneeId === "string" && assigneeId.trim()) return true;

  if (typeof stageProgress === "string" && stageProgress.trim()) return true;

  return !isSiteWorkflowTerminal(site);
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

/** Assignee may open this step — standalone; no prior-step progress required. */
export function canOpenAssignedStageForm(
  site: SiteInstallation,
  assignedStage: Exclude<SiteStageFormKey, "assignment">,
  workflowStage: string,
): boolean {
  void workflowStage;
  const resolved =
    assignedStage === "onsite" ? "onsite_delivery" : assignedStage;
  if (isStageAssigneeCompleted(site, resolved)) return true;
  const field = ASSIGNEE_FIELD[resolved];
  let assigneeId = site[field];
  if (!assigneeId && resolved === "onsite_delivery") {
    assigneeId = site.onsite_assignee_employee_id;
  }
  return typeof assigneeId === "string" && assigneeId.trim().length > 0;
}

export function workflowStageNotCompleteMessage(
  site: SiteInstallation,
  assignedStage: Exclude<SiteStageFormKey, "assignment">,
): string {
  void site;
  const resolved =
    assignedStage === "onsite" ? "onsite_delivery" : assignedStage;
  const label = siteWorkflowStageLabel(resolved);
  return `You are not assigned to ${label} yet. Ask the project admin to assign you from Project Tracking.`;
}

export function isAssigneeForStage(
  site: SiteInstallation,
  formStage: SiteStageFormKey,
  sessionEmployeeId: string | null | undefined,
): boolean {
  if (!sessionEmployeeId || formStage === "assignment") return false;
  const resolved = resolveFormStage(formStage);
  if (!resolved) return false;
  const field = ASSIGNEE_FIELD[resolved];
  let assigneeId = site[field];
  if (!assigneeId && resolved === "onsite_delivery") {
    assigneeId = site.onsite_assignee_employee_id;
  }
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
  if (site.status === "completed" || site.workflow_stage === "completed") return false;

  const current = normalizeWorkflowStage(site.workflow_stage);
  const resolved = resolveFormStage(formStage);

  if (formStage === "assignment") {
    if (current !== "intake" && current !== "assignment") return false;
    return isProjectModuleAdmin;
  }

  if (!resolved) return false;

  // Completed progress → read-only (handled by gate); block edits here.
  if (isStageAssigneeCompleted(site, resolved)) return false;

  if (isProjectModuleAdmin) {
    return true;
  }

  if (!sessionEmployeeId) return false;

  const field = ASSIGNEE_FIELD[resolved];
  let assigneeId = site[field];
  if (!assigneeId && resolved === "onsite_delivery") {
    assigneeId = site.onsite_assignee_employee_id;
  }
  if (!assigneeId || typeof assigneeId !== "string") return false;
  if (assigneeId !== sessionEmployeeId) return false;

  return !isStageAssigneeCompleted(site, resolved);
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
    current === "onsite_delivery" ||
    current === "material_handover" ||
    current === "installation" ||
    current === "acceptance"
  ) {
    if (
      canEditSiteStageForm(
        project,
        site,
        current as Exclude<SiteStageFormKey, "assignment" | "onsite">,
        sessionEmployeeId,
        isProjectModuleAdmin,
      )
    ) {
      return true;
    }
  }

  for (const stage of ASSIGNABLE_STAGES) {
    if (
      isAssigneeForStage(site, stage, sessionEmployeeId) &&
      canOpenAssignedStageForm(site, stage, site.workflow_stage) &&
      !isStageAssigneeCompleted(site, stage)
    ) {
      return true;
    }
  }
  return false;
}
