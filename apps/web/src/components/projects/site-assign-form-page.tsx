"use client";

import { useCallback, useMemo } from "react";
import { Users } from "lucide-react";

import {
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  assigneePayloadFromValues,
  assigneeValuesFromSite,
  stageAssignmentSection,
} from "@/components/projects/site-stage-assignments";
import {
  advanceSiteInstallation,
  getProject,
  getSiteInstallationByProject,
  listEmployeeOptions,
  updateSiteInstallationByProject,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  project_label: "",
  site_name: "",
  delivery_type: "",
  survey_assignee_employee_id: "",
  scm_assignee_employee_id: "",
  installation_assignee_employee_id: "",
  acceptance_assignee_employee_id: "",
};

export function SiteAssignFormPage({ projectId }: { projectId: string }) {
  const load = useCallback(async () => {
    const [project, site, employees] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
      listEmployeeOptions().catch(() => []),
    ]);

    return {
      values: {
        project_label: `${project.project_name} (${project.project_code})`,
        site_name: site.site_name ?? "",
        delivery_type: site.delivery_type ?? "",
        ...assigneeValuesFromSite(site),
      } satisfies FormValues,
      lookups: { employees },
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
      {
        title: "Project",
        subtitle: "Step 2 — Assign people for each delivery stage, then continue to Survey.",
        icon: Users,
        fields: [
          { name: "project_label", label: "Project", type: "readonly" },
          { name: "site_name", label: "Site", type: "readonly" },
        ],
      },
      stageAssignmentSection(),
    ],
    [],
  );

  return (
    <ProjectsRecordForm
      title="Assign stage owners"
      description="Step 2 — Project assignee selects who owns Survey, SCM, Installation & Configuration, and Acceptance. Next: Survey."
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
