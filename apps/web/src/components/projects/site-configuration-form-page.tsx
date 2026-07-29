"use client";

import { useCallback, useMemo, useState } from "react";
import { Wrench } from "lucide-react";

import {
  deliveryIncludesBios,
  deliveryIncludesOs,
} from "@/components/projects/projects-domain";
import {
  ProjectsRecordForm,
  orNull,
  type FormSection,
  type FormValues,
} from "@/components/projects/projects-record-form";
import {
  advanceSiteInstallation,
  getProject,
  getSiteInstallationByProject,
  listEmployeeOptions,
  updateSiteInstallationByProject,
} from "@/services/projects-portal-service";
import {
  resolveStageOwnerDisplay,
  stageOwnerBannerSection,
} from "@/components/projects/site-stage-assignments";

const EMPTY: FormValues = {
  project_label: "",
  site_name: "",
  delivery_type: "server_os_rack",
  stage_assignee_label: "",
  bios_configuration_done: "false",
  bios_configuration_date: "",
  firmware_nw_config_done: "false",
  firmware_nw_config_date: "",
  lld_done: "false",
  lld_date: "",
  os_installation_done: "false",
  os_installation_date: "",
  mbss_done: "false",
  mbss_date: "",
};

function asBool(v: string | undefined): boolean {
  return v === "true";
}

function dateOrEmpty(v: string | null | undefined): string {
  return v ? String(v).slice(0, 10) : "";
}

export function SiteConfigurationFormPage({ projectId }: { projectId: string }) {
  const [deliveryType, setDeliveryType] = useState("server_os_rack");
  const showBios = deliveryIncludesBios(deliveryType);
  const showOs = deliveryIncludesOs(deliveryType);

  const load = useCallback(async () => {
    const [project, site, employees] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
      listEmployeeOptions().catch(() => []),
    ]);
    setDeliveryType(site.delivery_type || "server_os_rack");
    const owner = resolveStageOwnerDisplay(site, "configuration", employees);

    return {
      values: {
        project_label: `${project.project_name} (${project.project_code})`,
        site_name: site.site_name ?? "",
        stage_assignee_label: owner.stage_assignee_label,
        delivery_type: site.delivery_type || "server_os_rack",
        bios_configuration_done: site.bios_configuration_done ? "true" : "false",
        bios_configuration_date: dateOrEmpty(site.bios_configuration_date),
        firmware_nw_config_done: site.firmware_nw_config_done ? "true" : "false",
        firmware_nw_config_date: dateOrEmpty(site.firmware_nw_config_date),
        lld_done: site.lld_done ? "true" : "false",
        lld_date: dateOrEmpty(site.lld_date),
        os_installation_done: site.os_installation_done ? "true" : "false",
        os_installation_date: dateOrEmpty(site.os_installation_date),
        mbss_done: site.mbss_done ? "true" : "false",
        mbss_date: dateOrEmpty(site.mbss_date),
      } satisfies FormValues,
    };
  }, [projectId]);

  const onSave = useCallback(
    async (v: FormValues) => {
      const type = v.delivery_type || deliveryType;
      const includeOs = deliveryIncludesOs(type);
      await updateSiteInstallationByProject(projectId, {
        bios_configuration_done: asBool(v.bios_configuration_done),
        bios_configuration_date: asBool(v.bios_configuration_done)
          ? orNull(v.bios_configuration_date)
          : null,
        firmware_nw_config_done: asBool(v.firmware_nw_config_done),
        firmware_nw_config_date: asBool(v.firmware_nw_config_done)
          ? orNull(v.firmware_nw_config_date)
          : null,
        lld_done: asBool(v.lld_done),
        lld_date: asBool(v.lld_done) ? orNull(v.lld_date) : null,
        os_installation_done: includeOs ? asBool(v.os_installation_done) : false,
        os_installation_date:
          includeOs && asBool(v.os_installation_done) ? orNull(v.os_installation_date) : null,
        mbss_done: includeOs ? asBool(v.mbss_done) : false,
        mbss_date: includeOs && asBool(v.mbss_done) ? orNull(v.mbss_date) : null,
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
          clearFieldsOnChange: ["bios_configuration_date"],
        },
        {
          name: "bios_configuration_date",
          label: "BIOS Configuration Date",
          type: "date",
          required: true,
          visibleWhen: (v) => v.bios_configuration_done === "true",
        },
        {
          name: "firmware_nw_config_done",
          label: "Firmware / N/W Configuration",
          type: "checkbox",
          clearFieldsOnChange: ["firmware_nw_config_date"],
        },
        {
          name: "firmware_nw_config_date",
          label: "Firmware / N/W Date",
          type: "date",
          required: true,
          visibleWhen: (v) => v.firmware_nw_config_done === "true",
        },
        {
          name: "lld_done",
          label: "LLD Availability",
          type: "checkbox",
          clearFieldsOnChange: ["lld_date"],
        },
        {
          name: "lld_date",
          label: "LLD Date",
          type: "date",
          required: true,
          visibleWhen: (v) => v.lld_done === "true",
        },
      );
    }

    if (showOs) {
      fields.push(
        {
          name: "os_installation_done",
          label: "OS Installation",
          type: "checkbox",
          clearFieldsOnChange: ["os_installation_date"],
        },
        {
          name: "os_installation_date",
          label: "OS Installation Date",
          type: "date",
          required: true,
          visibleWhen: (v) => v.os_installation_done === "true",
        },
        {
          name: "mbss_done",
          label: "MBSS",
          type: "checkbox",
          clearFieldsOnChange: ["mbss_date"],
        },
        {
          name: "mbss_date",
          label: "MBSS Date",
          type: "date",
          required: true,
          visibleWhen: (v) => v.mbss_done === "true",
        },
      );
    }

    return [
      stageOwnerBannerSection(),
      {
        title: "Configuration",
        subtitle: showOs
          ? "Step 6 — BIOS / Firmware / N/W · LLD · OS · MBSS. Next: Acceptance."
          : "Step 6 — BIOS / Firmware / N/W · LLD. Next: Acceptance.",
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
          ? "Step 6 — Confirm BIOS, firmware/N/W, LLD, OS installation, and MBSS."
          : "Step 6 — Confirm BIOS, firmware / N/W configuration, and LLD availability."
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
