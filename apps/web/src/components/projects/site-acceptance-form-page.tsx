"use client";

import { useCallback, useMemo, useState } from "react";
import { CloudUpload } from "lucide-react";

import {
  deliveryIncludesOs,
  deliveryIsRackOnly,
  deliveryNeedsHwat,
} from "@/components/projects/projects-domain";
import {
  ProjectsRecordForm,
  orNull,
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
  advanceSiteInstallation,
  getProject,
  getSiteInstallationByProject,
  updateSiteInstallationByProject,
} from "@/services/projects-portal-service";
import {
  resolveStageOwnerDisplay,
  stageOwnerBannerSection,
} from "@/components/projects/site-stage-assignments";

const EMPTY: FormValues = {
  ...INTAKE_SUMMARY_EMPTY,
  delivery_type: "server_os_rack",
  stage_assignee_label: "",
  os_installation_done: "",
  mbss_done: "",
  vascan_done: "",
  handover_to_cloud_done: "false",
  handover_to_cloud_date: "",
  hwat_request_done: "false",
  hwat_request_date: "",
  hwat_signoff_received: "false",
  hwat_signoff_date: "",
};

function asBool(v: string | undefined): boolean {
  return v === "true";
}

function dateOrEmpty(v: string | null | undefined): string {
  return v ? String(v).slice(0, 10) : "";
}

export function SiteAcceptanceFormPage({ projectId }: { projectId: string }) {
  const [deliveryType, setDeliveryType] = useState("server_os_rack");
  const needsHwat = deliveryNeedsHwat(deliveryType);
  const showOsStatus = deliveryIncludesOs(deliveryType);

  const load = useCallback(async () => {
    const [project, site, lookups] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
      loadIntakeSummaryLookups(),
    ]);
    const type = site.delivery_type || "server_os_rack";
    setDeliveryType(type);
    const owner = resolveStageOwnerDisplay(site, "acceptance", lookups.employees);

    return {
      values: {
        ...intakeSummaryValues({
          project,
          site,
          branches: lookups.branches,
          customers: lookups.customers,
          employees: lookups.employees,
        }),
        stage_assignee_label: owner.stage_assignee_label,
        delivery_type: type,
        os_installation_done: site.os_installation_done ? "Done" : "Pending",
        mbss_done: site.mbss_done ? "Done" : "Pending",
        vascan_done: site.vascan_done ? "Done" : "Pending",
        handover_to_cloud_done: site.handover_to_cloud_done ? "true" : "false",
        handover_to_cloud_date: dateOrEmpty(site.handover_to_cloud_date),
        hwat_request_done: site.hwat_request_done ? "true" : "false",
        hwat_request_date: dateOrEmpty(site.hwat_request_date),
        hwat_signoff_received: site.hwat_signoff_received ? "true" : "false",
        hwat_signoff_date: dateOrEmpty(site.hwat_signoff_date),
      } satisfies FormValues,
    };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const type = v.delivery_type || deliveryType;
      const rackOnly = deliveryIsRackOnly(type);
      const hwat = !rackOnly && deliveryNeedsHwat(type);

      await updateSiteInstallationByProject(projectId, {
        handover_to_cloud_done: asBool(v.handover_to_cloud_done),
        handover_to_cloud_date: asBool(v.handover_to_cloud_done)
          ? orNull(v.handover_to_cloud_date)
          : null,
        hwat_request_done: hwat ? asBool(v.hwat_request_done) : false,
        hwat_request_date: hwat && asBool(v.hwat_request_done) ? orNull(v.hwat_request_date) : null,
        hwat_signoff_received: hwat ? asBool(v.hwat_signoff_received) : false,
        hwat_signoff_date:
          hwat && asBool(v.hwat_signoff_received) ? orNull(v.hwat_signoff_date) : null,
      });

      let site = await getSiteInstallationByProject(projectId);
      if (site.workflow_stage === "installation") {
        site = await advanceSiteInstallation(projectId, "complete_installation");
      }
      if (site.workflow_stage === "acceptance") {
        await advanceSiteInstallation(projectId, "complete_acceptance");
      }

      return `/projects/projects/${projectId}`;
    },
    [deliveryType, projectId],
  );

  const sections = useMemo<FormSection[]>(() => {
    const fields: FormSection["fields"] = [];

    if (showOsStatus) {
      fields.push(
        {
          name: "os_installation_done",
          label: "OS Installation (from Configuration)",
          type: "readonly",
        },
        {
          name: "mbss_done",
          label: "MBSS (from Configuration)",
          type: "readonly",
        },
        {
          name: "vascan_done",
          label: "VASCAN (from Configuration)",
          type: "readonly",
        },
      );
    }

    fields.push(
      {
        name: "handover_to_cloud_done",
        label: "Handover to Application Team",
        type: "checkbox",
        hint: "Common exit for all delivery scopes.",
        clearFieldsOnChange: ["handover_to_cloud_date"],
      },
      {
        name: "handover_to_cloud_date",
        label: "Handover to Application Team Date",
        type: "date",
        required: true,
        visibleWhen: (v) => v.handover_to_cloud_done === "true",
      },
    );

    if (needsHwat) {
      fields.push(
        {
          name: "hwat_request_done",
          label: "HWAT Request",
          type: "checkbox",
          clearFieldsOnChange: ["hwat_request_date"],
        },
        {
          name: "hwat_request_date",
          label: "HWAT Request Date",
          type: "date",
          required: true,
          visibleWhen: (v) => v.hwat_request_done === "true",
        },
        {
          name: "hwat_signoff_received",
          label: "HWAT Sign-off from Circle",
          type: "checkbox",
          clearFieldsOnChange: ["hwat_signoff_date"],
        },
        {
          name: "hwat_signoff_date",
          label: "HWAT Sign-off Date",
          type: "date",
          required: true,
          visibleWhen: (v) => v.hwat_signoff_received === "true",
        },
      );
    }

    return [
      intakeSummarySection(),
      stageOwnerBannerSection(),
      {
        title: "Acceptance / Closure",
        subtitle: needsHwat
          ? "Step 6 — HWAT + Circle sign-off · Handover to Application Team"
          : "Step 6 — Rack handover · Handover to Application Team",
        icon: CloudUpload,
        fields,
      },
    ];
  }, [needsHwat, showOsStatus]);

  return (
    <ProjectsRecordForm
      title="Acceptance / Closure"
      description={
        needsHwat
          ? "Step 6 — Complete HWAT, Circle sign-off, and Handover to Application Team."
          : "Step 6 — Rack Installation only — complete Handover to Application Team to close."
      }
      backHref={`/projects/projects/${projectId}`}
      backLabel="Back to project"
      submitLabel="Complete Acceptance"
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
