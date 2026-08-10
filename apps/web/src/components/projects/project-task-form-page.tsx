"use client";

import { useCallback, useMemo } from "react";
import { CalendarRange, ClipboardList } from "lucide-react";

import { TASK_PRIORITIES, TASK_STATUSES } from "@/components/projects/projects-domain";
import {
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  createProjectTask,
  getProjectTask,
  listBranchOptions,
  listMilestoneOptions,
  listPhaseOptions,
  listProjectOptions,
  listTaskOptions,
  updateProjectTask,
  type ProjectTaskFormInput,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  document_number: "",
  branch_id: "",
  project_id: "",
  phase_id: "",
  milestone_id: "",
  parent_task_id: "",
  task_name: "",
  priority: "medium",
  planned_start_date: "",
  due_date: "",
  estimated_hours: "",
  actual_hours: "",
  percent_complete: "",
  status: "open",
};

export function ProjectTaskFormPage({
  taskId,
  presetProjectId,
}: {
  taskId?: string;
  presetProjectId?: string;
}) {
  const isEdit = Boolean(taskId);

  const load = useCallback(async () => {
    const [branches, projects, phases, milestones, tasks, record] = await Promise.all([
      listBranchOptions().catch(() => []),
      listProjectOptions().catch(() => []),
      listPhaseOptions().catch(() => []),
      listMilestoneOptions().catch(() => []),
      listTaskOptions().catch(() => []),
      taskId ? getProjectTask(taskId) : Promise.resolve(null),
    ]);

    const values: FormValues = record
      ? {
          document_number: record.document_number ?? "",
          branch_id: record.branch_id,
          project_id: record.project_id,
          phase_id: record.phase_id ?? "",
          milestone_id: record.milestone_id ?? "",
          parent_task_id: record.parent_task_id ?? "",
          task_name: record.task_name,
          priority: record.priority,
          planned_start_date: record.planned_start_date ?? "",
          due_date: record.due_date ?? "",
          estimated_hours: record.estimated_hours ?? "",
          actual_hours: record.actual_hours ?? "",
          percent_complete: record.percent_complete ?? "",
          status: record.status,
        }
      : { branch_id: branches[0]?.id ?? "", project_id: presetProjectId ?? "" };

    return { values, lookups: { branches, projects, phases, milestones, tasks } };
  }, [taskId, presetProjectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const payload: ProjectTaskFormInput = {
        project_id: v.project_id,
        phase_id: orNull(v.phase_id),
        milestone_id: orNull(v.milestone_id),
        parent_task_id: orNull(v.parent_task_id),
        task_name: v.task_name.trim(),
        priority: v.priority || "medium",
        planned_start_date: orNull(v.planned_start_date),
        due_date: orNull(v.due_date),
        estimated_hours: orNull(v.estimated_hours),
        actual_hours: orNull(v.actual_hours),
        percent_complete: orNull(v.percent_complete),
        status: v.status || "open",
      };

      const saved =
        isEdit && taskId
          ? await updateProjectTask(taskId, payload)
          : await createProjectTask({ ...payload, branch_id: v.branch_id });

      return `/projects/projects/${saved.project_id}`;
    },
    [isEdit, taskId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      {
        title: "Task Information",
        subtitle: "Where this work item sits in the work breakdown structure",
        icon: ClipboardList,
        fields: [
          isEdit
            ? { name: "document_number", label: "Task No.", type: "readonly" as const }
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
          { name: "task_name", label: "Task Name", type: "text", required: true },
          { name: "phase_id", label: "Phase", type: "select", optionsKey: "phases" },
          { name: "milestone_id", label: "Milestone", type: "select", optionsKey: "milestones" },
          {
            name: "parent_task_id",
            label: "Parent Task",
            type: "select",
            optionsKey: "tasks",
            placeholder: "Top-level task",
          },
          {
            name: "priority",
            label: "Priority",
            type: "select",
            required: true,
            options: TASK_PRIORITIES,
          },
          { name: "status", label: "Status", type: "select", required: true, options: TASK_STATUSES },
        ],
      },
      {
        title: "Schedule & Effort",
        subtitle: "Planned dates, estimated effort, and progress",
        icon: CalendarRange,
        fields: [
          { name: "planned_start_date", label: "Start Date", type: "date" },
          { name: "due_date", label: "Due Date", type: "date" },
          { name: "estimated_hours", label: "Estimated Hours", type: "number", step: "0.01" },
          { name: "actual_hours", label: "Actual Hours", type: "number", step: "0.01" },
          {
            name: "percent_complete",
            label: "Percent Complete",
            type: "number",
            step: "0.01",
            min: "0",
            max: "100",
          },
        ],
      },
    ],
    [isEdit],
  );

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Task" : "New Task"}
      description="Tasks carry the delivery work. They can nest under a parent task to form sub-tasks."
      backHref="/projects/project-tasks"
      backLabel="Back to tasks"
      submitLabel={isEdit ? "Save changes" : "Create Task"}
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
