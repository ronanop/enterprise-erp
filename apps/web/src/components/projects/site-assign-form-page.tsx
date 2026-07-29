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
  assigneePayloadFromValues,
  assigneeValuesFromSite,
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
  scm_assignee_employee_id: "",
  installation_assignee_employee_id: "",
  acceptance_assignee_employee_id: "",
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
        ...assigneeValuesFromSite(site),
      } satisfies FormValues,
      lookups: { employees: lookups.employees },
    };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      await updateSiteInstallationByProject(projectId, {
        ...assigneePayloadFromValues(v),
      });

      let site = await getSiteInstallationByProject(projectId);
      if (site.workflow_stage === "intake") {
        site = await advanceSiteInstallation(projectId, "complete_intake");
      }
      if (site.workflow_stage === "assignment") {
        await advanceSiteInstallation(projectId, "complete_assignment");
      }

      return `/projects/projects/${projectId}/survey`;
    },
    [projectId],
  );

  const sections = useMemo<FormSection[]>(
    () => [
      intakeSummarySection(),
      {
        title: "Assign stage owners",
        subtitle: "Step 2 — Select who owns each delivery stage, then continue to Survey.",
        icon: Users,
        fields: stageAssignmentSection(deliveryType).fields,
      },
    ],
    [deliveryType],
  );

  return (
    <ProjectsRecordForm
      title="Assign stage owners"
      description={
        deliveryType === "rack_only"
          ? "Step 2 — Select who owns Survey, SCM, Installation, and Acceptance. Next: Survey."
          : "Step 2 — Project assignee selects who owns Survey, SCM, Installation & Configuration, and Acceptance. Next: Survey."
      }
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
