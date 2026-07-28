"use client";

import { useCallback, useMemo } from "react";
import { CalendarRange } from "lucide-react";

import { RESOURCE_PLAN_STATUSES } from "@/components/projects/projects-domain";
import {
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  createResourcePlan,
  getResourcePlan,
  listProjectOptions,
  updateResourcePlan,
  type ResourcePlanFormInput,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  document_number: "",
  project_id: "",
  plan_name: "",
  planned_from: "",
  planned_to: "",
  status: "draft",
};

export function ResourcePlanFormPage({ planId }: { planId?: string }) {
  const isEdit = Boolean(planId);

  const load = useCallback(async () => {
    const [projects, record] = await Promise.all([
      listProjectOptions().catch(() => []),
      planId ? getResourcePlan(planId) : Promise.resolve(null),
    ]);

    const values: FormValues = record
      ? {
          document_number: record.document_number,
          project_id: record.project_id,
          plan_name: record.plan_name,
          planned_from: record.planned_from,
          planned_to: record.planned_to,
          status: record.status,
        }
      : {};

    return { values, lookups: { projects } };
  }, [planId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const payload: ResourcePlanFormInput = {
        project_id: v.project_id,
        plan_name: v.plan_name.trim(),
        planned_from: v.planned_from,
        planned_to: v.planned_to,
        status: v.status || "draft",
      };

      const saved =
        isEdit && planId
          ? await updateResourcePlan(planId, payload)
          : await createResourcePlan(payload);

      return `/projects/resource-plans/${saved.id}/edit`;
    },
    [isEdit, planId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      {
        title: "Resource Plan",
        subtitle: "The staffing window that allocations are booked against",
        icon: CalendarRange,
        fields: [
          ...(isEdit
            ? [{ name: "document_number", label: "Plan No.", type: "readonly" as const }]
            : []),
          {
            name: "project_id",
            label: "Project",
            type: "select",
            required: true,
            optionsKey: "projects",
          },
          { name: "plan_name", label: "Plan Name", type: "text", required: true },
          { name: "planned_from", label: "Planned From", type: "date", required: true },
          {
            name: "planned_to",
            label: "Planned To",
            type: "date",
            required: true,
            hint: "Must be on or after the planned from date.",
          },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            options: RESOURCE_PLAN_STATUSES,
          },
        ],
      },
    ],
    [isEdit],
  );

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Resource Plan" : "New Resource Plan"}
      description="Create the staffing window first, then book allocations against it."
      backHref="/projects/resource-plans"
      backLabel="Back to resource plans"
      submitLabel={isEdit ? "Save changes" : "Create Plan"}
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
