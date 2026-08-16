import type { FieldSpec, FormSection, FormValues } from "@/components/projects/projects-record-form";
import type { SiteInstallation } from "@/services/projects-portal-service";
import { Users } from "lucide-react";

export const STAGE_ASSIGNEE_FIELDS = [
  {
    stage: "survey",
    name: "survey_assignee_employee_id",
    label: "Survey assignee",
    assignedDateField: "survey_assigned_date",
  },
  {
    stage: "scm",
    name: "scm_assignee_employee_id",
    label: "SCM / Logistics assignee",
    assignedDateField: "scm_assigned_date",
  },
  {
    stage: "onsite_delivery",
    name: "onsite_delivery_assignee_employee_id",
    label: "Onsite Delivery assignee",
    assignedDateField: "onsite_delivery_assigned_date",
  },
  {
    stage: "material_handover",
    name: "material_handover_assignee_employee_id",
    label: "Material Handover assignee",
    assignedDateField: "material_handover_assigned_date",
  },
  {
    stage: "installation",
    name: "installation_assignee_employee_id",
    label: "Installation & Configuration assignee",
    assignedDateField: "installation_assigned_date",
  },
  {
    stage: "acceptance",
    name: "acceptance_assignee_employee_id",
    label: "Acceptance assignee",
    assignedDateField: "acceptance_assigned_date",
  },
] as const;

export type StageAssigneeFieldName = (typeof STAGE_ASSIGNEE_FIELDS)[number]["name"];
export type AssignableStage = (typeof STAGE_ASSIGNEE_FIELDS)[number]["stage"];

const STAGE_ORDER = [
  "intake",
  "assignment",
  "survey",
  "scm",
  "onsite_delivery",
  "onsite",
  "material_handover",
  "installation",
  "acceptance",
  "completed",
] as const;

const ASSIGNABLE_STAGES = [
  "survey",
  "scm",
  "onsite_delivery",
  "material_handover",
  "installation",
  "acceptance",
] as const;

/** Step owner progress that lets the admin assign the next stage. */
export function progressAllowsNextStageAssignment(
  progressStatus: string | null | undefined,
): boolean {
  return (
    progressStatus === "completed" || progressStatus === "partial_completed"
  );
}

/** Only Completed closes the step for My Jobs / read-only. */
export function progressMarksStageCompleted(
  progressStatus: string | null | undefined,
): boolean {
  return progressStatus === "completed";
}

type StageAssignmentRow = {
  stage: string;
  work_status: string;
  progress_status?: string | null;
  label?: string;
};

function previousStageReadyForNextAssignment(
  prevRow: StageAssignmentRow | undefined,
): boolean {
  if (!prevRow) return false;
  if (progressAllowsNextStageAssignment(prevRow.progress_status)) return true;
  // Legacy / workflow-advanced rows without progress_status
  return prevRow.work_status === "done";
}

function stageAssignmentClosed(row: StageAssignmentRow): boolean {
  return (
    row.work_status === "done" ||
    progressMarksStageCompleted(row.progress_status)
  );
}

export function assigneeFieldForStage(stage: AssignableStage) {
  return STAGE_ASSIGNEE_FIELDS.find((f) => f.stage === stage)!;
}

/** Previous assignable work stage, or null for Survey. */
export function previousAssignableStage(stage: string): AssignableStage | null {
  const normalized =
    stage === "configuration"
      ? "installation"
      : stage === "onsite"
        ? "onsite_delivery"
        : stage;
  const idx = ASSIGNABLE_STAGES.indexOf(normalized as AssignableStage);
  if (idx <= 0) return null;
  return ASSIGNABLE_STAGES[idx - 1];
}

/**
 * Whether Project Tracking may show an assignee picker for this stage.
 * Survey: after project create (until Survey workflow is Done).
 * Later stages: when the previous stage progress is Partial completed or Completed.
 * Onsite Delivery is auto-assigned to PM — still allow admin reassignment until completed.
 */
export function canAssignStageFromTracking(
  stage: string,
  assignments: StageAssignmentRow[],
  isAdmin: boolean,
): boolean {
  if (!isAdmin) return false;
  const normalized =
    stage === "configuration"
      ? "installation"
      : stage === "onsite"
        ? "onsite_delivery"
        : stage;
  if (!ASSIGNABLE_STAGES.includes(normalized as AssignableStage)) return false;

  const row = assignments.find((a) => a.stage === normalized);
  if (!row || stageAssignmentClosed(row)) return false;

  const prev = previousAssignableStage(normalized);
  if (!prev) {
    // Survey — assign anytime before survey workflow completes
    return row.work_status === "pending" || row.work_status === "in_progress";
  }

  const prevRow = assignments.find((a) => a.stage === prev);
  return previousStageReadyForNextAssignment(prevRow);
}

export function assignWaitingHint(
  stage: string,
  assignments: StageAssignmentRow[],
): string | null {
  const normalized =
    stage === "configuration"
      ? "installation"
      : stage === "onsite"
        ? "onsite_delivery"
        : stage;
  const prev = previousAssignableStage(normalized);
  if (!prev) return null;
  const prevRow = assignments.find((a) => a.stage === prev);
  if (previousStageReadyForNextAssignment(prevRow)) return null;
  return `Assign after ${prevRow?.label ?? prev} is Partial completed or Completed`;
}

export function stageWorkStatus(
  stage: string,
  currentStage: string,
  _deliveryType: string,
): "pending" | "in_progress" | "done" | "skipped" {
  const normalizedStage =
    stage === "configuration"
      ? "installation"
      : stage === "onsite"
        ? "onsite_delivery"
        : stage;
  let normalizedCurrent =
    currentStage === "configuration"
      ? "installation"
      : currentStage === "onsite"
        ? "onsite_delivery"
        : currentStage;
  if (normalizedCurrent === "assignment") normalizedCurrent = "survey";
  const cur = STAGE_ORDER.indexOf(normalizedCurrent as (typeof STAGE_ORDER)[number]);
  const idx = STAGE_ORDER.indexOf(normalizedStage as (typeof STAGE_ORDER)[number]);
  if (cur < 0 || idx < 0) return "pending";
  if (cur > idx) return "done";
  if (cur === idx) return "in_progress";
  return "pending";
}

export function workStatusLabel(status: string): string {
  switch (status) {
    case "done":
      return "Done";
    case "in_progress":
      return "In progress";
    case "skipped":
      return "Skipped";
    default:
      return "Pending";
  }
}

export function assigneeValuesFromSite(site: SiteInstallation): FormValues {
  return {
    survey_assignee_employee_id: site.survey_assignee_employee_id ?? "",
    scm_assignee_employee_id: site.scm_assignee_employee_id ?? "",
    onsite_delivery_assignee_employee_id:
      site.onsite_delivery_assignee_employee_id ??
      site.onsite_assignee_employee_id ??
      "",
    material_handover_assignee_employee_id:
      site.material_handover_assignee_employee_id ?? "",
    installation_assignee_employee_id: site.installation_assignee_employee_id ?? "",
    acceptance_assignee_employee_id: site.acceptance_assignee_employee_id ?? "",
  };
}

export function assigneePayloadFromValues(
  v: FormValues,
): Partial<Record<StageAssigneeFieldName, string | null>> {
  const out: Partial<Record<StageAssigneeFieldName, string | null>> = {};
  for (const field of STAGE_ASSIGNEE_FIELDS) {
    const raw = (v[field.name] ?? "").trim();
    out[field.name] = raw || null;
  }
  return out;
}

/** Editable assignment section — Survey owner only (later owners from Project Tracking). */
export function stageAssignmentSection(deliveryType?: string): FormSection {
  void deliveryType;
  const survey = STAGE_ASSIGNEE_FIELDS[0];
  return {
    title: "Assign Survey owner",
    subtitle:
      "Select who owns Survey. Later stage owners are assigned from Project Tracking after each step completes.",
    icon: Users,
    fields: [
      {
        name: survey.name,
        label: survey.label,
        type: "select" as const,
        required: true,
        optionsKey: "employees",
        placeholder: "Select person…",
      } satisfies FieldSpec,
    ],
  };
}

export function stageOwnerBannerSection(): FormSection {
  return {
    title: "Stage owner",
    subtitle: "Assigned by the project owner. Status updates when this stage is completed.",
    icon: Users,
    fields: [
      {
        name: "stage_assignee_label",
        label: "Assigned to",
        type: "readonly",
      },
    ],
  };
}

export function resolveStageOwnerDisplay(
  site: SiteInstallation,
  stage: AssignableStage,
  employees: Array<{ id: string; label: string }>,
): { stage_assignee_label: string } {
  const field = assigneeFieldForStage(stage);
  let id = site[field.name as keyof SiteInstallation] as string | null | undefined;
  if (!id && stage === "onsite_delivery") {
    id = site.onsite_assignee_employee_id;
  }
  const name =
    employees.find((e) => e.id === id)?.label ??
    (id ? "Assigned (name unavailable)" : "Unassigned");
  const status = workStatusLabel(
    stageWorkStatus(stage, site.workflow_stage, site.delivery_type),
  );
  return {
    stage_assignee_label: `${name} · ${status}`,
  };
}
