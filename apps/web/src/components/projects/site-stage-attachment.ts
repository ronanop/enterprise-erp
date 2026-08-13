import { ClipboardList, MessageSquareText, Paperclip } from "lucide-react";

import type { FormSection, FormValues } from "@/components/projects/projects-record-form";

export const STAGE_PROGRESS_OPTIONS = [
  { value: "in_progress", label: "In progress" },
  { value: "partial_completed", label: "Partial completed" },
  { value: "completed", label: "Completed" },
] as const;

export type StageAttachmentField =
  | "survey_attachment_name"
  | "scm_attachment_name"
  | "onsite_attachment_name"
  | "installation_attachment_name"
  | "acceptance_attachment_name";

export type StageProgressField =
  | "survey_progress_status"
  | "scm_progress_status"
  | "onsite_progress_status"
  | "installation_progress_status"
  | "acceptance_progress_status";

export type StageRemarksField =
  | "survey_remarks"
  | "scm_remarks"
  | "onsite_remarks"
  | "installation_remarks"
  | "acceptance_remarks";

/** Progress selector shown above the attachment section. */
export function stageProgressSection(
  progressField: StageProgressField,
  stageLabel: string,
): FormSection {
  return {
    title: "Step progress",
    subtitle: `Tell the admin how ${stageLabel} is progressing.`,
    icon: ClipboardList,
    fields: [
      {
        name: progressField,
        label: "Progress status",
        type: "select",
        required: true,
        full: true,
        options: [...STAGE_PROGRESS_OPTIONS],
        hint: "In progress / Partial completed / Completed — shown on Project Tracking.",
      },
    ],
  };
}

/** Mandatory upload control. */
export function stageAttachmentSection(
  fieldName: StageAttachmentField,
  stageLabel: string,
): FormSection {
  return {
    title: "Upload Attachment",
    subtitle: `Attach supporting evidence for ${stageLabel} before saving.`,
    icon: Paperclip,
    fields: [
      {
        name: fieldName,
        label: "Upload Attachment",
        type: "file",
        required: true,
        full: true,
        hint: "PDF, images, or office documents. Required to complete this step.",
      },
    ],
  };
}

/** Free-text remarks after attachment. */
export function stageRemarksSection(remarksField: StageRemarksField): FormSection {
  return {
    title: "Remarks",
    subtitle: "Optional notes for the project admin.",
    icon: MessageSquareText,
    fields: [
      {
        name: remarksField,
        label: "Remarks",
        type: "textarea",
        full: true,
        placeholder: "Add any remarks for this step…",
      },
    ],
  };
}

export function stageClosingSections(
  progressField: StageProgressField,
  attachmentField: StageAttachmentField,
  remarksField: StageRemarksField,
  stageLabel: string,
): FormSection[] {
  return [
    stageProgressSection(progressField, stageLabel),
    stageAttachmentSection(attachmentField, stageLabel),
    stageRemarksSection(remarksField),
  ];
}

/** Collect Yes/No fields that were answered No (for admin notification). */
export function collectNoAnswers(
  values: FormValues,
  fields: Array<{ name: string; label: string }>,
): Array<{ field: string; label: string }> {
  return fields
    .filter((f) => values[f.name] === "false")
    .map((f) => ({ field: f.name, label: f.label }));
}

/**
 * Only Nos newly selected this save (avoids notifying on every save when DB
 * defaults are false / unchecked).
 */
export function collectNewNoAnswers(
  values: FormValues,
  previous: FormValues | null | undefined,
  fields: Array<{ name: string; label: string }>,
): Array<{ field: string; label: string }> {
  return collectNoAnswers(values, fields).filter((item) => {
    const before = previous?.[item.field];
    return before !== "false";
  });
}

export function stageProgressLabel(status: string | null | undefined): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "partial_completed":
      return "Partial completed";
    case "in_progress":
      return "In progress";
    default:
      return "—";
  }
}

/** Partial completed and Completed both allow workflow advance / step handoff. */
export function isProgressCompleteForAdvance(
  status: string | null | undefined,
): boolean {
  return status === "completed" || status === "partial_completed";
}
