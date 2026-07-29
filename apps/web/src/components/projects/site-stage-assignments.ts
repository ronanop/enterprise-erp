import type { FieldSpec, FormSection, FormValues } from "@/components/projects/projects-record-form";
import type { SiteInstallation } from "@/services/projects-portal-service";
import { Users } from "lucide-react";

export const STAGE_ASSIGNEE_FIELDS = [
  {
    stage: "survey",
    name: "survey_assignee_employee_id",
    label: "Survey assignee",
  },
  {
    stage: "scm",
    name: "scm_assignee_employee_id",
    label: "SCM / Logistics assignee",
  },
  {
    stage: "installation",
    name: "installation_assignee_employee_id",
    label: "Installation & Configuration assignee",
  },
  {
    stage: "acceptance",
    name: "acceptance_assignee_employee_id",
    label: "Acceptance assignee",
  },
] as const;

export type StageAssigneeFieldName = (typeof STAGE_ASSIGNEE_FIELDS)[number]["name"];
export type AssignableStage = (typeof STAGE_ASSIGNEE_FIELDS)[number]["stage"];

const STAGE_ORDER = [
  "intake",
  "assignment",
  "survey",
  "scm",
  "installation",
  "acceptance",
  "completed",
] as const;

export function stageWorkStatus(
  stage: string,
  currentStage: string,
  _deliveryType: string,
): "pending" | "in_progress" | "done" | "skipped" {
  const normalizedStage = stage === "configuration" ? "installation" : stage;
  const normalizedCurrent =
    currentStage === "configuration" ? "installation" : currentStage;
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

/** Editable assignment section — shown on Assign stage owners step. */
export function stageAssignmentSection(): FormSection {
  const fields: FieldSpec[] = STAGE_ASSIGNEE_FIELDS.map((f) => ({
    name: f.name,
    label: f.label,
    type: "select" as const,
    required: true,
    optionsKey: "employees",
    placeholder: "Select person…",
  }));

  return {
    title: "Assign stage owners",
    subtitle:
      "Select who owns each step. Work status updates when the stage is completed.",
    icon: Users,
    fields,
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

export function assigneeFieldForStage(stage: AssignableStage) {
  return STAGE_ASSIGNEE_FIELDS.find((f) => f.stage === stage)!;
}

export function resolveStageOwnerDisplay(
  site: SiteInstallation,
  stage: AssignableStage,
  employees: Array<{ id: string; label: string }>,
): { stage_assignee_label: string } {
  const field = assigneeFieldForStage(stage);
  const id = site[field.name];
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
