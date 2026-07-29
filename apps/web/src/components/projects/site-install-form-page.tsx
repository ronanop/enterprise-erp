"use client";

import { useCallback, useMemo, useState } from "react";
import { Server, Wrench } from "lucide-react";

import {
  deliveryIncludesBios,
  deliveryIncludesOs,
  deliveryIsRackOnly,
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
  rack_server_stacking_done: "false",
  rack_server_stacking_date: "",
  rack_server_power_on_done: "false",
  rack_server_power_on_date: "",
  dac_ilo_cabling_done: "false",
  dac_ilo_cabling_date: "",
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

export function SiteInstallFormPage({ projectId }: { projectId: string }) {
  const [deliveryType, setDeliveryType] = useState("server_os_rack");
  const isRackOnly = deliveryIsRackOnly(deliveryType);
  const showBios = deliveryIncludesBios(deliveryType);
  const showOs = deliveryIncludesOs(deliveryType);

  const load = useCallback(async () => {
    const [project, site, employees] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
      listEmployeeOptions().catch(() => []),
    ]);
    setDeliveryType(site.delivery_type || "server_os_rack");
    const owner = resolveStageOwnerDisplay(site, "installation", employees);

    return {
      values: {
        project_label: `${project.project_name} (${project.project_code})`,
        site_name: site.site_name ?? "",
        stage_assignee_label: owner.stage_assignee_label,
        delivery_type: site.delivery_type || "server_os_rack",
        rack_server_stacking_done: site.rack_server_stacking_done ? "true" : "false",
        rack_server_stacking_date: dateOrEmpty(site.rack_server_stacking_date),
        rack_server_power_on_done: site.rack_server_power_on_done ? "true" : "false",
        rack_server_power_on_date: dateOrEmpty(site.rack_server_power_on_date),
        dac_ilo_cabling_done: site.dac_ilo_cabling_done ? "true" : "false",
        dac_ilo_cabling_date: dateOrEmpty(site.dac_ilo_cabling_date),
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
      const rackOnly = deliveryIsRackOnly(type);
      const includeOs = deliveryIncludesOs(type);
      const includeBios = deliveryIncludesBios(type);

      await updateSiteInstallationByProject(projectId, {
        rack_server_stacking_done: asBool(v.rack_server_stacking_done),
        rack_server_stacking_date: asBool(v.rack_server_stacking_done)
          ? orNull(v.rack_server_stacking_date)
          : null,
        rack_server_power_on_done: rackOnly ? false : asBool(v.rack_server_power_on_done),
        rack_server_power_on_date:
          rackOnly || !asBool(v.rack_server_power_on_done)
            ? null
            : orNull(v.rack_server_power_on_date),
        dac_ilo_cabling_done: rackOnly ? false : asBool(v.dac_ilo_cabling_done),
        dac_ilo_cabling_date:
          rackOnly || !asBool(v.dac_ilo_cabling_done) ? null : orNull(v.dac_ilo_cabling_date),
        bios_configuration_done: includeBios ? asBool(v.bios_configuration_done) : false,
        bios_configuration_date:
          includeBios && asBool(v.bios_configuration_done)
            ? orNull(v.bios_configuration_date)
            : null,
        firmware_nw_config_done: includeBios ? asBool(v.firmware_nw_config_done) : false,
        firmware_nw_config_date:
          includeBios && asBool(v.firmware_nw_config_done)
            ? orNull(v.firmware_nw_config_date)
            : null,
        lld_done: includeBios ? asBool(v.lld_done) : false,
        lld_date: includeBios && asBool(v.lld_done) ? orNull(v.lld_date) : null,
        os_installation_done: includeOs ? asBool(v.os_installation_done) : false,
        os_installation_date:
          includeOs && asBool(v.os_installation_done) ? orNull(v.os_installation_date) : null,
        mbss_done: includeOs ? asBool(v.mbss_done) : false,
        mbss_date: includeOs && asBool(v.mbss_done) ? orNull(v.mbss_date) : null,
      });

      let site = await getSiteInstallationByProject(projectId);
      if (site.workflow_stage === "scm") {
        site = await advanceSiteInstallation(projectId, "complete_scm");
      }
      if (site.workflow_stage === "installation") {
        await advanceSiteInstallation(projectId, "complete_installation");
      }

      return `/projects/projects/${projectId}/acceptance`;
    },
    [deliveryType, projectId],
  );

  const sections = useMemo<FormSection[]>(() => {
    const installFields: FormSection["fields"] = [
      { name: "project_label", label: "Project", type: "readonly" },
      { name: "site_name", label: "Site", type: "readonly" },
      {
        name: "rack_server_stacking_done",
        label: isRackOnly ? "Rack Installation" : "Rack Installation + Server Stacking",
        type: "checkbox",
        clearFieldsOnChange: ["rack_server_stacking_date"],
      },
      {
        name: "rack_server_stacking_date",
        label: isRackOnly ? "Rack Installation Date" : "Rack + Stacking Date",
        type: "date",
        required: true,
        visibleWhen: (v) => v.rack_server_stacking_done === "true",
      },
    ];

    if (!isRackOnly) {
      installFields.push(
        {
          name: "rack_server_power_on_done",
          label: "Rack + Server Power On",
          type: "checkbox",
          clearFieldsOnChange: ["rack_server_power_on_date"],
        },
        {
          name: "rack_server_power_on_date",
          label: "Power On Date",
          type: "date",
          required: true,
          visibleWhen: (v) => v.rack_server_power_on_done === "true",
        },
        {
          name: "dac_ilo_cabling_done",
          label: "DAC / ILO Cabling",
          type: "checkbox",
          clearFieldsOnChange: ["dac_ilo_cabling_date"],
        },
        {
          name: "dac_ilo_cabling_date",
          label: "DAC / ILO Cabling Date",
          type: "date",
          required: true,
          visibleWhen: (v) => v.dac_ilo_cabling_done === "true",
        },
      );
    }

    const sectionsOut: FormSection[] = [
      stageOwnerBannerSection(),
      {
        title: "Installation",
        subtitle: isRackOnly
          ? "Rack installation at site"
          : "Rack + stacking · Power on · DAC/ILO",
        icon: Server,
        fields: installFields,
      },
    ];

    if (showBios || showOs) {
      const configFields: FormSection["fields"] = [];
      if (showBios) {
        configFields.push(
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
        configFields.push(
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
      sectionsOut.push({
        title: "Configuration",
        subtitle: showOs
          ? "BIOS / Firmware / N/W · LLD · OS · MBSS"
          : "BIOS / Firmware / N/W · LLD",
        icon: Wrench,
        fields: configFields,
      });
    }

    return sectionsOut;
  }, [isRackOnly, showBios, showOs]);

  return (
    <ProjectsRecordForm
      title="Installation & Configuration"
      description={
        isRackOnly
          ? "Step 5 — Confirm rack installation, then continue to Acceptance."
          : "Step 5 — Installation and configuration in one step. Next: Acceptance."
      }
      backHref={`/projects/projects/${projectId}`}
      backLabel="Back to project"
      submitLabel="Complete & continue to Acceptance"
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
    />
  );
}
