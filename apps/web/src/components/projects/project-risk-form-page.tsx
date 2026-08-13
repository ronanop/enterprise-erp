"use client";

import { useCallback, useMemo } from "react";
import { ShieldAlert } from "lucide-react";

import { RISK_STATUSES, SEVERITY_LEVELS } from "@/components/projects/projects-domain";
import {
  orNull,
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  createProjectRisk,
  getProjectRisk,
  listEmployeeOptions,
  listProjectOptions,
  updateProjectRisk,
  type ProjectRiskFormInput,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  document_number: "",
  project_id: "",
  risk_name: "",
  impact: "medium",
  probability: "medium",
  risk_level: "medium",
  owner_employee_id: "",
  review_date: "",
  mitigation_plan: "",
  status: "identified",
};

export function ProjectRiskFormPage({
  riskId,
  presetProjectId,
}: {
  riskId?: string;
  presetProjectId?: string;
}) {
  const isEdit = Boolean(riskId);

  const load = useCallback(async () => {
    const [projects, employees, record] = await Promise.all([
      listProjectOptions().catch(() => []),
      listEmployeeOptions().catch(() => []),
      riskId ? getProjectRisk(riskId) : Promise.resolve(null),
    ]);

    const values: FormValues = record
      ? {
          document_number: record.document_number,
          project_id: record.project_id,
          risk_name: record.risk_name,
          impact: record.impact,
          probability: record.probability,
          risk_level: record.risk_level,
          owner_employee_id: record.owner_employee_id ?? "",
          review_date: record.review_date ?? "",
          mitigation_plan: record.mitigation_plan ?? "",
          status: record.status,
        }
      : { project_id: presetProjectId ?? "" };

    return { values, lookups: { projects, employees } };
  }, [riskId, presetProjectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const payload: ProjectRiskFormInput = {
        project_id: v.project_id,
        risk_name: v.risk_name.trim(),
        impact: v.impact || "medium",
        probability: v.probability || "medium",
        risk_level: v.risk_level || "medium",
        owner_employee_id: orNull(v.owner_employee_id),
        review_date: orNull(v.review_date),
        mitigation_plan: orNull(v.mitigation_plan),
        status: v.status || "identified",
      };

      const saved =
        isEdit && riskId
          ? await updateProjectRisk(riskId, payload)
          : await createProjectRisk(payload);

      return `/projects/projects/${saved.project_id}`;
    },
    [isEdit, riskId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      {
        title: "Risk Information",
        subtitle: "Impact × probability sets the risk level used on the register",
        icon: ShieldAlert,
        fields: [
          ...(isEdit
            ? [{ name: "document_number", label: "Risk No.", type: "readonly" as const }]
            : []),
          {
            name: "project_id",
            label: "Project",
            type: "select",
            required: true,
            optionsKey: "projects",
          },
          { name: "risk_name", label: "Risk Name", type: "text", required: true, full: true },
          {
            name: "impact",
            label: "Impact",
            type: "select",
            required: true,
            options: SEVERITY_LEVELS,
          },
          {
            name: "probability",
            label: "Probability",
            type: "select",
            required: true,
            options: SEVERITY_LEVELS,
          },
          {
            name: "risk_level",
            label: "Risk Level",
            type: "select",
            required: true,
            options: SEVERITY_LEVELS,
          },
          { name: "owner_employee_id", label: "Owner", type: "select", optionsKey: "employees" },
          { name: "review_date", label: "Review Date", type: "date" },
          { name: "status", label: "Status", type: "select", required: true, options: RISK_STATUSES },
          {
            name: "mitigation_plan",
            label: "Mitigation Plan",
            type: "textarea",
            full: true,
            placeholder: "How this risk will be contained…",
          },
        ],
      },
    ],
    [isEdit],
  );

  return (
    <ProjectsRecordForm
      title={isEdit ? "Edit Risk" : "New Risk"}
      description="Risks stay on the register through mitigation until they are accepted or closed."
      backHref="/projects/project-risks"
      backLabel="Back to risks"
      submitLabel={isEdit ? "Save changes" : "Create Risk"}
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
