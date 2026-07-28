"use client";

import { useCallback, useMemo, useState } from "react";
import { Wrench } from "lucide-react";

import {
  deliveryIncludesBios,
  deliveryIncludesOs,
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
  bios_configuration_done: "false",
  firmware_nw_config_done: "false",
  lld_done: "false",
  os_installation_done: "false",
  mbss_done: "false",
};

function asBool(v: string | undefined): boolean {
  return v === "true";
}

export function SiteConfigurationFormPage({ projectId }: { projectId: string }) {
  const [deliveryType, setDeliveryType] = useState("server_os_rack");
  const showBios = deliveryIncludesBios(deliveryType);
  const showOs = deliveryIncludesOs(deliveryType);

  const load = useCallback(async () => {
    const [project, site] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
    ]);
    setDeliveryType(site.delivery_type || "server_os_rack");

    return {
      values: {
        project_label: `${project.project_name} (${project.project_code})`,
        site_name: site.site_name ?? "",
        delivery_type: site.delivery_type || "server_os_rack",
        bios_configuration_done: site.bios_configuration_done ? "true" : "false",
        firmware_nw_config_done: site.firmware_nw_config_done ? "true" : "false",
        lld_done: site.lld_done ? "true" : "false",
        os_installation_done: site.os_installation_done ? "true" : "false",
        mbss_done: site.mbss_done ? "true" : "false",
      } satisfies FormValues,
    };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const type = v.delivery_type || deliveryType;
      await updateSiteInstallationByProject(projectId, {
        bios_configuration_done: asBool(v.bios_configuration_done),
        firmware_nw_config_done: asBool(v.firmware_nw_config_done),
        lld_done: asBool(v.lld_done),
        os_installation_done: deliveryIncludesOs(type) ? asBool(v.os_installation_done) : false,
        mbss_done: deliveryIncludesOs(type) ? asBool(v.mbss_done) : false,
      });

      let site = await getSiteInstallationByProject(projectId);
      if (site.workflow_stage === "installation") {
        site = await advanceSiteInstallation(projectId, "complete_installation");
      }
      if (site.workflow_stage === "configuration") {
        await advanceSiteInstallation(projectId, "complete_configuration");
      }

      return `/projects/projects/${projectId}/acceptance`;
    },
    [deliveryType, projectId],
  );

  const sections = useMemo<FormSection[]>(() => {
    const fields: FormSection["fields"] = [
      { name: "project_label", label: "Project", type: "readonly" },
      { name: "site_name", label: "Site", type: "readonly" },
    ];

    if (showBios) {
      fields.push(
        {
          name: "bios_configuration_done",
          label: "BIOS Configuration",
          type: "checkbox",
          required: true,
        },
        {
          name: "firmware_nw_config_done",
          label: "Firmware / N/W Configuration",
          type: "checkbox",
          required: true,
        },
        {
          name: "lld_done",
          label: "LLD Availability",
          type: "checkbox",
          required: true,
        },
      );
    }

    if (showOs) {
      fields.push(
        {
          name: "os_installation_done",
          label: "OS Installation",
          type: "checkbox",
          required: true,
        },
        {
          name: "mbss_done",
          label: "MBSS",
          type: "checkbox",
          required: true,
        },
      );
    }

    return [
      {
        title: "Configuration",
        subtitle: showOs
          ? "Step 5 — BIOS / Firmware / N/W · LLD · OS · MBSS. Next: Acceptance."
          : "Step 5 — BIOS / Firmware / N/W · LLD. Next: Acceptance.",
        icon: Wrench,
        fields,
      },
    ];
  }, [showBios, showOs]);

  return (
    <ProjectsRecordForm
      title="Configuration"
      description={
        showOs
          ? "Step 5 — Confirm BIOS, firmware/N/W, LLD, OS installation, and MBSS."
          : "Step 5 — Confirm BIOS, firmware / N/W configuration, and LLD availability."
      }
      backHref={`/projects/projects/${projectId}`}
      backLabel="Back to project"
      submitLabel="Complete Configuration"
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
