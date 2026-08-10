"use client";

import { useCallback, useMemo } from "react";
import { Users } from "lucide-react";

import { ALLOCATION_STATUSES, RESOURCE_TYPES } from "@/components/projects/projects-domain";
import {
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  createResourceAllocation,
  getResourceAllocation,
  listEmployeeOptions,
  listProjectOptions,
  listResourcePlanOptions,
  updateResourceAllocation,
  type ResourceAllocationFormInput,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  resource_plan_id: "",
  project_id: "",
  employee_id: "",
  resource_type: "employee",
  allocation_percent: "",
  start_date: "",
  end_date: "",
  status: "planned",
};

export function ResourceAllocationFormPage({ allocationId }: { allocationId?: string }) {
  const isEdit = Boolean(allocationId);

  const load = useCallback(async () => {
    const [plans, projects, employees, record] = await Promise.all([
      listResourcePlanOptions().catch(() => []),
      listProjectOptions().catch(() => []),
      listEmployeeOptions().catch(() => []),
      allocationId ? getResourceAllocation(allocationId) : Promise.resolve(null),
    ]);

    const values: FormValues = record
      ? {
          resource_plan_id: record.resource_plan_id,
          project_id: record.project_id,
          employee_id: record.employee_id,
          resource_type: record.resource_type,
          allocation_percent: record.allocation_percent,
          start_date: record.start_date,
          end_date: record.end_date,
          status: record.status,
        }
      : {};

    return { values, lookups: { plans, projects, employees } };
  }, [allocationId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const payload: ResourceAllocationFormInput = {
        resource_plan_id: v.resource_plan_id,
        project_id: v.project_id,
        employee_id: v.employee_id,
        resource_type: v.resource_type || "employee",
        allocation_percent: v.allocation_percent,
        start_date: v.start_date,
        end_date: v.end_date,
        status: v.status || "planned",
      };

      const saved =
        isEdit && allocationId
          ? await updateResourceAllocation(allocationId, payload)
          : await createResourceAllocation(payload);

      return `/projects/resource-allocations/${saved.id}/edit`;
    },
    [isEdit, allocationId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      {
        title: "Allocation",
        subtitle: "Book a resource onto a project for part of their capacity",
        icon: Users,
        fields: [
          {
            name: "resource_plan_id",
            label: "Resource Plan",
            type: "select",
            required: true,
            optionsKey: "plans",
          },
          {
            name: "project_id",
            label: "Project",
            type: "select",
            required: true,
            optionsKey: "projects",
          },
          {
            name: "employee_id",
            label: "Resource",
            type: "select",
            required: true,
            optionsKey: "employees",
          },
          {
            name: "resource_type",
            label: "Resource Type",
            type: "select",
            required: true,
            options: RESOURCE_TYPES,
          },
          {
            name: "allocation_percent",
            label: "Allocation %",
            type: "number",
            required: true,
            step: "0.01",
            min: "0",
            max: "100",
            hint: "Combined allocation for a resource across projects cannot exceed 100%.",
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            options: ALLOCATION_STATUSES,
          },
          { name: "start_date", label: "Start Date", type: "date", required: true },
          {
            name: "end_date",
            label: "End Date",
            type: "date",
            required: true,
            hint: "Must be on or after the start date.",
          },
        ],
      },
    ],
    [],
  );

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Allocation" : "New Allocation"}
      description="Allocations hang off a resource plan and drive resource utilisation reporting."
      backHref="/projects/resource-allocations"
      backLabel="Back to allocations"
      submitLabel={isEdit ? "Save changes" : "Create Allocation"}
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
