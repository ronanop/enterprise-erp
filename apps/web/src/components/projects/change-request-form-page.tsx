"use client";

import { useCallback, useMemo } from "react";
import { GitPullRequestArrow } from "lucide-react";

import { CHANGE_REQUEST_STATUSES, CHANGE_TYPES } from "@/components/projects/projects-domain";
import {
  intOrNull,
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  createChangeRequest,
  getChangeRequest,
  listBranchOptions,
  listEmployeeOptions,
  listProjectOptions,
  updateChangeRequest,
  type ChangeRequestFormInput,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  document_number: "",
  branch_id: "",
  project_id: "",
  change_title: "",
  change_type: "scope",
  requested_by_employee_id: "",
  budget_impact_amount: "",
  schedule_impact_days: "",
  impact_summary: "",
  status: "draft",
};

export function ChangeRequestFormPage({
  changeRequestId,
  presetProjectId,
}: {
  changeRequestId?: string;
  presetProjectId?: string;
}) {
  const isEdit = Boolean(changeRequestId);

  const load = useCallback(async () => {
    const [branches, projects, employees, record] = await Promise.all([
      listBranchOptions().catch(() => []),
      listProjectOptions().catch(() => []),
      listEmployeeOptions().catch(() => []),
      changeRequestId ? getChangeRequest(changeRequestId) : Promise.resolve(null),
    ]);

    const values: FormValues = record
      ? {
          document_number: record.document_number,
          branch_id: record.branch_id,
          project_id: record.project_id,
          change_title: record.change_title,
          change_type: record.change_type,
          requested_by_employee_id: record.requested_by_employee_id,
          budget_impact_amount: record.budget_impact_amount ?? "",
          schedule_impact_days:
            record.schedule_impact_days === null ? "" : String(record.schedule_impact_days),
          impact_summary: record.impact_summary ?? "",
          status: record.status,
        }
      : { branch_id: branches[0]?.id ?? "", project_id: presetProjectId ?? "" };

    return { values, lookups: { branches, projects, employees } };
  }, [changeRequestId, presetProjectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const payload: ChangeRequestFormInput = {
        project_id: v.project_id,
        change_title: v.change_title.trim(),
        change_type: v.change_type,
        requested_by_employee_id: v.requested_by_employee_id,
        budget_impact_amount: orNull(v.budget_impact_amount),
        schedule_impact_days: intOrNull(v.schedule_impact_days),
        impact_summary: orNull(v.impact_summary),
        status: v.status || "draft",
      };

      const saved =
        isEdit && changeRequestId
          ? await updateChangeRequest(changeRequestId, payload)
          : await createChangeRequest({ ...payload, branch_id: v.branch_id });

      return `/projects/projects/${saved.project_id}`;
    },
    [isEdit, changeRequestId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      {
        title: "Change Request",
        subtitle: "A formal request to alter scope, schedule, budget, or resourcing",
        icon: GitPullRequestArrow,
        fields: [
          isEdit
            ? { name: "document_number", label: "Change No.", type: "readonly" as const }
            : {
                name: "branch_id",
                label: "Branch",
                type: "select" as const,
                required: true,
                optionsKey: "branches",
              },
          {
            name: "project_id",
            label: "Project",
            type: "select",
            required: true,
            optionsKey: "projects",
          },
          { name: "change_title", label: "Change Title", type: "text", required: true, full: true },
          {
            name: "change_type",
            label: "Change Type",
            type: "select",
            required: true,
            options: CHANGE_TYPES,
          },
          {
            name: "requested_by_employee_id",
            label: "Requested By",
            type: "select",
            required: true,
            optionsKey: "employees",
          },
          {
            name: "budget_impact_amount",
            label: "Budget Impact",
            type: "number",
            step: "0.01",
          },
          {
            name: "schedule_impact_days",
            label: "Schedule Impact (days)",
            type: "number",
            step: "1",
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            options: CHANGE_REQUEST_STATUSES,
          },
          {
            name: "impact_summary",
            label: "Impact Summary",
            type: "textarea",
            full: true,
            placeholder: "What changes, and what it costs in time and money…",
          },
        ],
      },
    ],
    [isEdit],
  );

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Change Request" : "New Change Request"}
      description="Approved change requests revise the project baseline; budget impact flows to the project budget."
      backHref="/projects/change-requests"
      backLabel="Back to change requests"
      submitLabel={isEdit ? "Save changes" : "Create Change Request"}
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
