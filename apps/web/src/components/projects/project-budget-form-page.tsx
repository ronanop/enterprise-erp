"use client";

import { useCallback, useMemo } from "react";
import { Scale } from "lucide-react";

import { BUDGET_STATUSES, BUDGET_TYPES } from "@/components/projects/projects-domain";
import {
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  createProjectBudget,
  getProjectBudget,
  listProjectOptions,
  updateProjectBudget,
  type ProjectBudgetFormInput,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  document_number: "",
  project_id: "",
  budget_type: "",
  budget_amount: "",
  currency_code: "INR",
  cost_center_code: "",
  status: "draft",
};

export function ProjectBudgetFormPage({ budgetId }: { budgetId?: string }) {
  const isEdit = Boolean(budgetId);

  const load = useCallback(async () => {
    const [projects, record] = await Promise.all([
      listProjectOptions().catch(() => []),
      budgetId ? getProjectBudget(budgetId) : Promise.resolve(null),
    ]);

    const values: FormValues = record
      ? {
          document_number: record.document_number,
          project_id: record.project_id,
          budget_type: record.budget_type,
          budget_amount: record.budget_amount,
          currency_code: record.currency_code,
          cost_center_code: record.cost_center_code ?? "",
          status: record.status,
        }
      : {};

    return { values, lookups: { projects } };
  }, [budgetId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const payload: ProjectBudgetFormInput = {
        project_id: v.project_id,
        budget_type: v.budget_type,
        budget_amount: v.budget_amount,
        currency_code: v.currency_code.trim() || "INR",
        cost_center_code: orNull(v.cost_center_code),
        status: v.status || "draft",
      };

      const saved =
        isEdit && budgetId
          ? await updateProjectBudget(budgetId, payload)
          : await createProjectBudget(payload);

      return `/projects/project-budgets/${saved.id}/edit`;
    },
    [isEdit, budgetId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      {
        title: "Budget Information",
        subtitle: "One line per budget type on a project",
        icon: Scale,
        fields: [
          ...(isEdit
            ? [{ name: "document_number", label: "Budget No.", type: "readonly" as const }]
            : []),
          {
            name: "project_id",
            label: "Project",
            type: "select",
            required: true,
            optionsKey: "projects",
          },
          {
            name: "budget_type",
            label: "Budget Type",
            type: "select",
            required: true,
            options: BUDGET_TYPES,
          },
          {
            name: "budget_amount",
            label: "Budget Amount",
            type: "number",
            required: true,
            step: "0.01",
            min: "0",
          },
          { name: "currency_code", label: "Currency", type: "text", required: true },
          { name: "cost_center_code", label: "Cost Center", type: "text" },
          {
            name: "status",
            label: "Status",
            type: "select",
            required: true,
            options: BUDGET_STATUSES,
          },
        ],
      },
    ],
    [isEdit],
  );

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Budget" : "New Budget"}
      description="Budgets route Project Manager → Finance for approval, then govern spend against actual costs."
      backHref="/projects/project-budgets"
      backLabel="Back to budgets"
      submitLabel={isEdit ? "Save changes" : "Create Budget"}
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
