"use client";

import { useCallback, useMemo } from "react";
import { CalendarClock } from "lucide-react";

import { TIMESHEET_ENTRY_STATUSES } from "@/components/projects/projects-domain";
import {
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  createTimesheetEntry,
  getTimesheetEntry,
  listBranchOptions,
  listEmployeeOptions,
  listProjectOptions,
  listTaskOptions,
  listTimesheetOptions,
  updateTimesheetEntry,
  type TimesheetEntryFormInput,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  branch_id: "",
  timesheet_id: "",
  project_id: "",
  task_id: "",
  employee_id: "",
  work_date: "",
  hours_worked: "",
  description: "",
  status: "draft",
};

export function TimesheetEntryFormPage({ entryId }: { entryId?: string }) {
  const isEdit = Boolean(entryId);

  const load = useCallback(async () => {
    const [branches, timesheets, projects, tasks, employees, record] = await Promise.all([
      listBranchOptions().catch(() => []),
      listTimesheetOptions().catch(() => []),
      listProjectOptions().catch(() => []),
      listTaskOptions().catch(() => []),
      listEmployeeOptions().catch(() => []),
      entryId ? getTimesheetEntry(entryId) : Promise.resolve(null),
    ]);

    const values: FormValues = record
      ? {
          branch_id: record.branch_id,
          timesheet_id: record.timesheet_id,
          project_id: record.project_id,
          task_id: record.task_id,
          employee_id: record.employee_id,
          work_date: record.work_date,
          hours_worked: record.hours_worked,
          description: record.description ?? "",
          status: record.status,
        }
      : { branch_id: branches[0]?.id ?? "" };

    return { values, lookups: { branches, timesheets, projects, tasks, employees } };
  }, [entryId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const payload: TimesheetEntryFormInput = {
        timesheet_id: v.timesheet_id,
        project_id: v.project_id,
        task_id: v.task_id,
        employee_id: v.employee_id,
        work_date: v.work_date,
        hours_worked: v.hours_worked,
        description: orNull(v.description),
        status: v.status || "draft",
      };

      const saved =
        isEdit && entryId
          ? await updateTimesheetEntry(entryId, payload)
          : await createTimesheetEntry({ ...payload, branch_id: v.branch_id });

      return `/projects/timesheet-entries/${saved.id}/edit`;
    },
    [isEdit, entryId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      {
        title: "Time Entry",
        subtitle: "Effort logged for one employee, on one task, on one day",
        icon: CalendarClock,
        fields: [
          ...(isEdit
            ? []
            : [
                {
                  name: "branch_id",
                  label: "Branch",
                  type: "select" as const,
                  required: true,
                  optionsKey: "branches",
                },
              ]),
          {
            name: "timesheet_id",
            label: "Timesheet",
            type: "select",
            required: true,
            optionsKey: "timesheets",
          },
          {
            name: "project_id",
            label: "Project",
            type: "select",
            required: true,
            optionsKey: "projects",
          },
          { name: "task_id", label: "Task", type: "select", required: true, optionsKey: "tasks" },
          {
            name: "employee_id",
            label: "Employee",
            type: "select",
            required: true,
            optionsKey: "employees",
          },
          { name: "work_date", label: "Work Date", type: "date", required: true },
          {
            name: "hours_worked",
            label: "Hours Worked",
            type: "number",
            required: true,
            step: "0.25",
            min: "0.25",
            max: "24",
            hint: "Total hours per employee per day cannot exceed 24.",
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            options: TIMESHEET_ENTRY_STATUSES,
          },
          {
            name: "description",
            label: "Description",
            type: "textarea",
            full: true,
            placeholder: "What was worked on…",
          },
        ],
      },
    ],
    [isEdit],
  );

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Time Entry" : "New Time Entry"}
      description="Time entries are the daily lines behind a timesheet. They lock once the timesheet is approved."
      backHref="/projects/timesheet-entries"
      backLabel="Back to time entries"
      submitLabel={isEdit ? "Save changes" : "Create Entry"}
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
