"use client";

import { useCallback, useMemo } from "react";
import { Flag } from "lucide-react";

import { MILESTONE_STATUSES } from "@/components/projects/projects-domain";
import {
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  createProjectMilestone,
  getProjectMilestone,
  listEmployeeOptions,
  listPhaseOptions,
  listProjectOptions,
  updateProjectMilestone,
  type ProjectMilestoneFormInput,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  milestone_code: "",
  project_id: "",
  phase_id: "",
  milestone_name: "",
  owner_employee_id: "",
  due_date: "",
  status: "planned",
};

export function ProjectMilestoneFormPage({
  milestoneId,
  presetProjectId,
}: {
  milestoneId?: string;
  presetProjectId?: string;
}) {
  const isEdit = Boolean(milestoneId);

  const load = useCallback(async () => {
    const [projects, phases, employees, record] = await Promise.all([
      listProjectOptions().catch(() => []),
      listPhaseOptions().catch(() => []),
      listEmployeeOptions().catch(() => []),
      milestoneId ? getProjectMilestone(milestoneId) : Promise.resolve(null),
    ]);

    const values: FormValues = record
      ? {
          milestone_code: record.milestone_code,
          project_id: record.project_id,
          phase_id: record.phase_id ?? "",
          milestone_name: record.milestone_name,
          owner_employee_id: record.owner_employee_id ?? "",
          due_date: record.due_date,
          status: record.status,
        }
      : { project_id: presetProjectId ?? "" };

    return { values, lookups: { projects, phases, employees } };
  }, [milestoneId, presetProjectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const payload: ProjectMilestoneFormInput = {
        project_id: v.project_id,
        phase_id: orNull(v.phase_id),
        milestone_name: v.milestone_name.trim(),
        owner_employee_id: orNull(v.owner_employee_id),
        due_date: v.due_date,
        status: v.status || "planned",
      };

      const saved =
        isEdit && milestoneId
          ? await updateProjectMilestone(milestoneId, payload)
          : await createProjectMilestone(payload);

      return `/projects/projects/${saved.project_id}`;
    },
    [isEdit, milestoneId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      {
        title: "Milestone Information",
        subtitle: "A major checkpoint on the delivery timeline",
        icon: Flag,
        fields: [
          ...(isEdit
            ? [{ name: "milestone_code", label: "Milestone Code", type: "readonly" as const }]
            : []),
          {
            name: "project_id",
            label: "Project",
            type: "select",
            required: true,
            optionsKey: "projects",
          },
          { name: "phase_id", label: "Phase", type: "select", optionsKey: "phases" },
          { name: "milestone_name", label: "Milestone Name", type: "text", required: true },
          {
            name: "owner_employee_id",
            label: "Owner",
            type: "select",
            optionsKey: "employees",
          },
          { name: "due_date", label: "Due Date", type: "date", required: true },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            options: MILESTONE_STATUSES,
          },
        ],
      },
    ],
    [isEdit],
  );

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Milestone" : "New Milestone"}
      description="Milestones are planned, then marked achieved or delayed. Milestone-based billing triggers off them."
      backHref="/projects/project-milestones"
      backLabel="Back to milestones"
      submitLabel={isEdit ? "Save changes" : "Create Milestone"}
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
