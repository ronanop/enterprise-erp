"use client";

import { useCallback, useMemo, useState } from "react";
import { Users } from "lucide-react";

import {
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  INTAKE_SUMMARY_EMPTY,
  intakeSummarySection,
  intakeSummaryValues,
  loadIntakeSummaryLookups,
} from "@/components/projects/site-intake-summary";
import {
  stageAssignmentSection,
} from "@/components/projects/site-stage-assignments";
import {
  advanceSiteInstallation,
  getProject,
  getSiteInstallationByProject,
  updateSiteInstallationByProject,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  ...INTAKE_SUMMARY_EMPTY,
  delivery_type: "",
  survey_assignee_employee_id: "",
};

export function SiteAssignFormPage({ projectId }: { projectId: string }) {
  const [deliveryType, setDeliveryType] = useState("");

  const load = useCallback(async () => {
    const [project, site, lookups] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
      loadIntakeSummaryLookups(),
    ]);
    setDeliveryType(site.delivery_type ?? "");

    return {
      values: {
        ...intakeSummaryValues({
          project,
          site,
          branches: lookups.branches,
          customers: lookups.customers,
          employees: lookups.employees,
        }),
        delivery_type: site.delivery_type ?? "",
        survey_assignee_employee_id: site.survey_assignee_employee_id ?? "",
      } satisfies FormValues,
      lookups: { employees: lookups.employees },
    };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const surveyAssignee = (v.survey_assignee_employee_id ?? "").trim() || null;
      await updateSiteInstallationByProject(projectId, {
        survey_assignee_employee_id: surveyAssignee,
      });

      let site = await getSiteInstallationByProject(projectId);
      if (site.workflow_stage === "intake") {
        site = await advanceSiteInstallation(projectId, "complete_intake");
      }
      if (site.workflow_stage === "assignment") {
        await advanceSiteInstallation(projectId, "complete_assignment");
      }

      return `/projects/projects/${projectId}`;
    },
    [projectId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      intakeSummarySection(),
      {
        ...stageAssignmentSection(deliveryType),
        title: "Assign Survey owner",
        subtitle:
          "Step 2 — Select the Survey owner. SCM, Installation, and Acceptance owners are assigned later from Project Tracking after each step completes.",
        icon: Users,
      },
    ],
    [deliveryType],
  );

  return (
    <ProjectsRecordForm
      title="Assign Survey owner"
      description="Select who owns Survey. Later stage owners are assigned one-by-one from Project Tracking after the previous step is completed."
      backHref={`/projects/projects/${projectId}`}
      backLabel="Back to project"
      submitLabel="Save & continue to Survey"
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
