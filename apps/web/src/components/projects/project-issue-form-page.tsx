"use client";

import { useCallback, useMemo } from "react";
import { CircleAlert } from "lucide-react";

import { ISSUE_STATUSES, SEVERITY_LEVELS } from "@/components/projects/projects-domain";
import {
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  createProjectIssue,
  getProjectIssue,
  listEmployeeOptions,
  listProjectOptions,
  listTaskOptions,
  updateProjectIssue,
  type ProjectIssueFormInput,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  document_number: "",
  project_id: "",
  task_id: "",
  issue_title: "",
  severity: "medium",
  owner_employee_id: "",
  status: "open",
};

export function ProjectIssueFormPage({
  issueId,
  presetProjectId,
}: {
  issueId?: string;
  presetProjectId?: string;
}) {
  const isEdit = Boolean(issueId);

  const load = useCallback(async () => {
    const [projects, tasks, employees, record] = await Promise.all([
      listProjectOptions().catch(() => []),
      listTaskOptions().catch(() => []),
      listEmployeeOptions().catch(() => []),
      issueId ? getProjectIssue(issueId) : Promise.resolve(null),
    ]);

    const values: FormValues = record
      ? {
          document_number: record.document_number,
          project_id: record.project_id,
          task_id: record.task_id ?? "",
          issue_title: record.issue_title,
          severity: record.severity,
          owner_employee_id: record.owner_employee_id ?? "",
          status: record.status,
        }
      : { project_id: presetProjectId ?? "" };

    return { values, lookups: { projects, tasks, employees } };
  }, [issueId, presetProjectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const payload: ProjectIssueFormInput = {
        project_id: v.project_id,
        task_id: orNull(v.task_id),
        issue_title: v.issue_title.trim(),
        severity: v.severity || "medium",
        owner_employee_id: orNull(v.owner_employee_id),
        status: v.status || "open",
      };

      const saved =
        isEdit && issueId
          ? await updateProjectIssue(issueId, payload)
          : await createProjectIssue(payload);

      return `/projects/projects/${saved.project_id}`;
    },
    [isEdit, issueId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      {
        title: "Issue Information",
        subtitle: "A blocker or defect raised during delivery",
        icon: CircleAlert,
        fields: [
          ...(isEdit
            ? [{ name: "document_number", label: "Issue No.", type: "readonly" as const }]
            : []),
          {
            name: "project_id",
            label: "Project",
            type: "select",
            required: true,
            optionsKey: "projects",
          },
          {
            name: "task_id",
            label: "Task",
            type: "select",
            optionsKey: "tasks",
            placeholder: "Project-level issue",
          },
          { name: "issue_title", label: "Issue Title", type: "text", required: true, full: true },
          {
            name: "severity",
            label: "Severity",
            type: "select",
            required: true,
            options: SEVERITY_LEVELS,
          },
          {
            name: "owner_employee_id",
            label: "Owner",
            type: "select",
            optionsKey: "employees",
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            options: ISSUE_STATUSES,
          },
        ],
      },
    ],
    [isEdit],
  );

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Issue" : "New Issue"}
      description="Log issues against a project or a specific task so blockers stay visible until resolved."
      backHref="/projects/project-issues"
      backLabel="Back to issues"
      submitLabel={isEdit ? "Save changes" : "Create Issue"}
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
