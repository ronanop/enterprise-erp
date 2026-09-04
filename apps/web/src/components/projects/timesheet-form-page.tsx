"use client";

import { useCallback, useMemo } from "react";
import { Timer } from "lucide-react";

import { TIMESHEET_STATUSES } from "@/components/projects/projects-domain";
import {
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  createTimesheet,
  getTimesheet,
  listBranchOptions,
  listEmployeeOptions,
  listProjectOptions,
  updateTimesheet,
  type TimesheetFormInput,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  document_number: "",
  branch_id: "",
  employee_id: "",
  project_id: "",
  period_start: "",
  period_end: "",
  total_hours: "",
  status: "draft",
};

export function TimesheetFormPage({ timesheetId }: { timesheetId?: string }) {
  const isEdit = Boolean(timesheetId);

  const load = useCallback(async () => {
    const [branches, employees, projects, record] = await Promise.all([
      listBranchOptions().catch(() => []),
      listEmployeeOptions().catch(() => []),
      listProjectOptions().catch(() => []),
      timesheetId ? getTimesheet(timesheetId) : Promise.resolve(null),
    ]);

    const values: FormValues = record
      ? {
          document_number: record.document_number,
          branch_id: record.branch_id,
          employee_id: record.employee_id,
          project_id: record.project_id ?? "",
          period_start: record.period_start,
          period_end: record.period_end,
          total_hours: record.total_hours ?? "",
          status: record.status,
        }
      : { branch_id: branches[0]?.id ?? "" };

    return { values, lookups: { branches, employees, projects } };
  }, [timesheetId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const payload: TimesheetFormInput = {
        employee_id: v.employee_id,
        project_id: orNull(v.project_id),
        period_start: v.period_start,
        period_end: v.period_end,
        total_hours: orNull(v.total_hours),
        status: v.status || "draft",
      };

      const saved =
        isEdit && timesheetId
          ? await updateTimesheet(timesheetId, payload)
          : await createTimesheet({ ...payload, branch_id: v.branch_id });

      return `/projects/timesheets/${saved.id}/edit`;
    },
    [isEdit, timesheetId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      {
        title: "Timesheet Information",
        subtitle: "One timesheet covers one employee for one period",
        icon: Timer,
        fields: [
          isEdit
            ? { name: "document_number", label: "Timesheet No.", type: "readonly" as const }
            : {
                name: "branch_id",
                label: "Branch",
                type: "select" as const,
                required: true,
                optionsKey: "branches",
              },
          {
            name: "employee_id",
            label: "Employee",
            type: "select",
            required: true,
            optionsKey: "employees",
          },
          {
            name: "project_id",
            label: "Project",
            type: "select",
            optionsKey: "projects",
            placeholder: "Across projects",
          },
          { name: "period_start", label: "Period Start", type: "date", required: true },
          {
            name: "period_end",
            label: "Period End",
            type: "date",
            required: true,
          },
          {
            name: "total_hours",
            label: "Total Hours",
            type: "number",
            step: "0.01",
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            options: TIMESHEET_STATUSES,
          },
        ],
      },
    ],
    [isEdit],
  );

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Timesheet" : "New Timesheet"}
      description="Timesheets are drafted, submitted to the manager, then approved. Approved timesheets feed project labour cost."
      backHref="/projects/timesheets"
      backLabel="Back to timesheets"
      submitLabel={isEdit ? "Save changes" : "Create Timesheet"}
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
