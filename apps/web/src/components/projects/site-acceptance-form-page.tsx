"use client";

import { useCallback, useMemo, useState } from "react";
import { CloudUpload } from "lucide-react";

import {
  deliveryIncludesOs,
  deliveryIsRackOnly,
  deliveryNeedsHwat,
  siteDeliveryTypeLabel,
} from "@/components/projects/projects-domain";
import {
  ProjectsRecordForm,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  advanceSiteInstallation,
  getProject,
  getSiteInstallationByProject,
  updateSiteInstallationByProject,
} from "@/services/projects-portal-service";

const EMPTY: FormValues = {
  project_label: "",
  site_name: "",
  delivery_type: "server_os_rack",
  delivery_type_label: "",
  os_installation_done: "",
  mbss_done: "",
  handover_to_cloud_done: "false",
  hwat_request_done: "false",
  hwat_signoff_received: "false",
};

function asBool(v: string | undefined): boolean {
  return v === "true";
}

export function SiteAcceptanceFormPage({ projectId }: { projectId: string }) {
  const [deliveryType, setDeliveryType] = useState("server_os_rack");
  const needsHwat = deliveryNeedsHwat(deliveryType);
  const showOsStatus = deliveryIncludesOs(deliveryType);

  const load = useCallback(async () => {
    const [project, site] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
    ]);
    const type = site.delivery_type || "server_os_rack";
    setDeliveryType(type);

    return {
      values: {
        project_label: `${project.project_name} (${project.project_code})`,
        site_name: site.site_name ?? "",
        delivery_type: type,
        delivery_type_label: siteDeliveryTypeLabel(type),
        os_installation_done: site.os_installation_done ? "Done" : "Pending",
        mbss_done: site.mbss_done ? "Done" : "Pending",
        handover_to_cloud_done: site.handover_to_cloud_done ? "true" : "false",
        hwat_request_done: site.hwat_request_done ? "true" : "false",
        hwat_signoff_received: site.hwat_signoff_received ? "true" : "false",
      } satisfies FormValues,
    };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const type = v.delivery_type || deliveryType;
      const rackOnly = deliveryIsRackOnly(type);

      await updateSiteInstallationByProject(projectId, {
        handover_to_cloud_done: asBool(v.handover_to_cloud_done),
        hwat_request_done: rackOnly ? false : asBool(v.hwat_request_done),
        hwat_signoff_received: rackOnly ? false : asBool(v.hwat_signoff_received),
      });

      let site = await getSiteInstallationByProject(projectId);
      if (site.workflow_stage === "configuration") {
        site = await advanceSiteInstallation(projectId, "complete_configuration");
      }
      if (site.workflow_stage === "installation" && deliveryIsRackOnly(site.delivery_type)) {
        site = await advanceSiteInstallation(projectId, "complete_installation_rack_only");
      }
      if (site.workflow_stage === "acceptance") {
        await advanceSiteInstallation(projectId, "complete_acceptance");
      }

      return `/projects/projects/${projectId}`;
    },
    [deliveryType, projectId],
  );

  const sections = useMemo<FormSection[]>(() => {
    const fields: FormSection["fields"] = [
      { name: "project_label", label: "Project", type: "readonly" },
      { name: "site_name", label: "Site", type: "readonly" },
      {
        name: "delivery_type_label",
        label: "Delivery scope",
        type: "readonly",
        full: true,
      },
    ];

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
      );
    }

    fields.push({
      name: "handover_to_cloud_done",
      label: "Handover to Cloud (HO Cloud)",
      type: "checkbox",
      required: true,
      hint: "Common exit for all delivery scopes.",
    });

    if (needsHwat) {
      fields.push(
        {
          name: "hwat_request_done",
          label: "HW AT Request",
          type: "checkbox",
          required: true,
        },
        {
          name: "hwat_signoff_received",
          label: "HW AT Sign-off from Circle",
          type: "checkbox",
          required: true,
        },
      );
    }

    return [
      {
        title: "Acceptance / Closure",
        subtitle: needsHwat
          ? "Step 6 — HW AT + Circle sign-off · Handover to Cloud"
          : "Step 6 — Rack handover · Handover to Cloud",
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
          ? "Step 6 — Complete HWAT, Circle sign-off, and Handover to Cloud."
          : "Step 6 — Rack Installation only — complete Handover to Cloud to close."
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
