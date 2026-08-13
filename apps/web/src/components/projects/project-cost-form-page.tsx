"use client";

import { useCallback, useMemo } from "react";
import { Receipt } from "lucide-react";

import { COST_SOURCES } from "@/components/projects/projects-domain";
import {
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  createProjectCost,
  getProjectCost,
  listBranchOptions,
  listEmployeeOptions,
  listProjectOptions,
  updateProjectCost,
  type ProjectCostFormInput,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  document_number: "",
  branch_id: "",
  project_id: "",
  cost_source: "manual",
  cost_amount: "",
  currency_code: "INR",
  cost_date: "",
  employee_id: "",
  status: "draft",
};

export function ProjectCostFormPage({ costId }: { costId?: string }) {
  const isEdit = Boolean(costId);

  const load = useCallback(async () => {
    const [branches, projects, employees, record] = await Promise.all([
      listBranchOptions().catch(() => []),
      listProjectOptions().catch(() => []),
      listEmployeeOptions().catch(() => []),
      costId ? getProjectCost(costId) : Promise.resolve(null),
    ]);

    const values: FormValues = record
      ? {
          document_number: record.document_number,
          branch_id: record.branch_id,
          project_id: record.project_id,
          cost_source: record.cost_source,
          cost_amount: record.cost_amount,
          currency_code: record.currency_code,
          cost_date: record.cost_date,
          employee_id: record.employee_id ?? "",
          status: record.status,
        }
      : { branch_id: branches[0]?.id ?? "" };

    return { values, lookups: { branches, projects, employees } };
  }, [costId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const payload: ProjectCostFormInput = {
        project_id: v.project_id,
        cost_source: v.cost_source,
        cost_amount: v.cost_amount,
        currency_code: v.currency_code.trim() || "INR",
        cost_date: v.cost_date,
        employee_id: orNull(v.employee_id),
        status: v.status || "draft",
      };

      const saved =
        isEdit && costId
          ? await updateProjectCost(costId, payload)
          : await createProjectCost({ ...payload, branch_id: v.branch_id });

      return `/projects/project-costs/${saved.id}/edit`;
    },
    [isEdit, costId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      {
        title: "Cost Information",
        subtitle: "Actual spend charged to a project",
        icon: Receipt,
        fields: [
          isEdit
            ? { name: "document_number", label: "Cost No.", type: "readonly" as const }
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
          {
            name: "cost_source",
            label: "Cost Source",
            type: "select",
            required: true,
            options: COST_SOURCES,
          },
          {
            name: "cost_amount",
            label: "Cost Amount",
            type: "number",
            required: true,
            step: "0.01",
            min: "0",
          },
          { name: "currency_code", label: "Currency", type: "text", required: true },
          { name: "cost_date", label: "Cost Date", type: "date", required: true },
          { name: "employee_id", label: "Employee", type: "select", optionsKey: "employees" },
        ],
      },
    ],
    [isEdit],
  );

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Cost" : "New Cost"}
      description="Captured costs stay in Draft until posted, at which point Finance writes the system journal."
      backHref="/projects/project-costs"
      backLabel="Back to costs"
      submitLabel={isEdit ? "Save changes" : "Create Cost"}
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
