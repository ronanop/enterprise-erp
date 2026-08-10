"use client";

import { useCallback, useMemo } from "react";
import { GitBranch } from "lucide-react";

import { PHASE_STATUSES } from "@/components/projects/projects-domain";
import {
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  createProjectPhase,
  getProjectPhase,
  listProjectOptions,
  updateProjectPhase,
  type ProjectPhaseFormInput,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  phase_code: "",
  project_id: "",
  phase_name: "",
  sequence_no: "1",
  planned_start_date: "",
  planned_end_date: "",
  status: "planned",
};

export function ProjectPhaseFormPage({
  phaseId,
  presetProjectId,
}: {
  phaseId?: string;
  presetProjectId?: string;
}) {
  const isEdit = Boolean(phaseId);

  const load = useCallback(async () => {
    const [projects, record] = await Promise.all([
      listProjectOptions().catch(() => []),
      phaseId ? getProjectPhase(phaseId) : Promise.resolve(null),
    ]);

    const values: FormValues = record
      ? {
          phase_code: record.phase_code,
          project_id: record.project_id,
          phase_name: record.phase_name,
          sequence_no: String(record.sequence_no),
          planned_start_date: record.planned_start_date,
          planned_end_date: record.planned_end_date,
          status: record.status,
        }
      : { project_id: presetProjectId ?? "" };

    return { values, lookups: { projects } };
  }, [phaseId, presetProjectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const payload: ProjectPhaseFormInput = {
        project_id: v.project_id,
        phase_name: v.phase_name.trim(),
        sequence_no: Number(v.sequence_no || 1),
        planned_start_date: v.planned_start_date,
        planned_end_date: v.planned_end_date,
        status: v.status || "planned",
      };

      const saved =
        isEdit && phaseId
          ? await updateProjectPhase(phaseId, payload)
          : await createProjectPhase(payload);

      return `/projects/projects/${saved.project_id}`;
    },
    [isEdit, phaseId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      {
        title: "Phase Information",
        subtitle: "A phase groups milestones and tasks inside a project",
        icon: GitBranch,
        fields: [
          ...(isEdit
            ? [{ name: "phase_code", label: "Phase Code", type: "readonly" as const }]
            : []),
          {
            name: "project_id",
            label: "Project",
            type: "select",
            required: true,
            optionsKey: "projects",
          },
          { name: "phase_name", label: "Phase Name", type: "text", required: true },
          {
            name: "sequence_no",
            label: "Sequence No.",
            type: "number",
            required: true,
            min: "1",
            step: "1",
          },
          { name: "status", label: "Status", type: "select", required: true, options: PHASE_STATUSES },
          {
            name: "planned_start_date",
            label: "Planned Start Date",
            type: "date",
            required: true,
          },
          {
            name: "planned_end_date",
            label: "Planned End Date",
            type: "date",
            required: true,
            hint: "Must be on or after the planned start date.",
          },
        ],
      },
    ],
    [isEdit],
  );

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Phase" : "New Phase"}
      description="Phases form the top level of the work breakdown structure: Project → Phase → Milestone → Task."
      backHref="/projects/project-phases"
      backLabel="Back to phases"
      submitLabel={isEdit ? "Save changes" : "Create Phase"}
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
