"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ClipboardList, Server, Wrench } from "lucide-react";

import {
  deliveryIncludesBios,
  deliveryIncludesOs,
  deliveryIncludesRack,
  deliveryIsRackOnly,
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
import {
  isProgressCompleteForAdvance,
  stageClosingSections,
} from "@/components/projects/site-stage-attachment";
import { useSiteStageFormReadOnlyMeta } from "@/components/projects/site-stage-form-read-only-context";
import { SiteStageExportButton } from "@/components/projects/site-stage-export-button";

const EMPTY: FormValues = {
  ...INTAKE_SUMMARY_EMPTY,
  delivery_type: "server_os_rack",
  stage_assignee_label: "",
  rack_server_stacking_done: "",
  rack_server_stacking_date: "",
  rack_server_power_on_done: "",
  rack_server_power_on_date: "",
  dac_ilo_cabling_done: "",
  dac_ilo_cabling_date: "",
  bios_configuration_done: "",
  bios_configuration_date: "",
  firmware_config_done: "",
  firmware_config_date: "",
  lld_done: "",
  lld_date: "",
  os_installation_done: "",
  os_installation_date: "",
  vm_installation_done: "",
  vm_installation_date: "",
  nw_config_done: "",
  nw_config_date: "",
  tools_integration_done: "",
  tools_integration_date: "",
  mbss_done: "",
  mbss_date: "",
  vascan_done: "",
  vascan_date: "",
  installation_progress_status: "",
  installation_attachment_name: "",
  installation_remarks: "",
  tile_details: "",
};

function asBool(v: string | undefined): boolean {
  return v === "true";
}

function dateOrEmpty(v: string | null | undefined): string {
  return v ? String(v).slice(0, 10) : "";
}

export function SiteInstallFormPage({ projectId }: { projectId: string }) {
  const stageFormMeta = useSiteStageFormReadOnlyMeta();
  const loadedValuesRef = useRef<FormValues | null>(null);
  const [deliveryType, setDeliveryType] = useState("server_os_rack");
  const isRackOnly = deliveryIsRackOnly(deliveryType);
  const hasRack = deliveryIncludesRack(deliveryType);
  const showBios = deliveryIncludesBios(deliveryType);
  const showOs = deliveryIncludesOs(deliveryType);

  const load = useCallback(async () => {
    const [project, site, lookups] = await Promise.all([
      getProject(projectId),
      getSiteInstallationByProject(projectId),
      loadIntakeSummaryLookups(),
    ]);
    setDeliveryType(site.delivery_type || "server_os_rack");
    const owner = resolveStageOwnerDisplay(site, "installation", lookups.employees);

    const values = {
      ...intakeSummaryValues({
        project,
        site,
        branches: lookups.branches,
        customers: lookups.customers,
        employees: lookups.employees,
      }),
      stage_assignee_label: owner.stage_assignee_label,
      delivery_type: site.delivery_type || "server_os_rack",
      rack_server_stacking_done: site.rack_server_stacking_done ? "true" : "",
      rack_server_stacking_date: dateOrEmpty(site.rack_server_stacking_date),
      rack_server_power_on_done: site.rack_server_power_on_done ? "true" : "",
      rack_server_power_on_date: dateOrEmpty(site.rack_server_power_on_date),
      dac_ilo_cabling_done: site.dac_ilo_cabling_done ? "true" : "",
      dac_ilo_cabling_date: dateOrEmpty(site.dac_ilo_cabling_date),
      bios_configuration_done: site.bios_configuration_done ? "true" : "",
      bios_configuration_date: dateOrEmpty(site.bios_configuration_date),
      firmware_config_done: site.firmware_config_done ? "true" : "",
      firmware_config_date: dateOrEmpty(site.firmware_config_date),
      lld_done: site.lld_done ? "true" : "",
      lld_date: dateOrEmpty(site.lld_date),
      os_installation_done: site.os_installation_done ? "true" : "",
      os_installation_date: dateOrEmpty(site.os_installation_date),
      vm_installation_done: site.vm_installation_done ? "true" : "",
      vm_installation_date: dateOrEmpty(site.vm_installation_date),
      nw_config_done: site.nw_config_done ? "true" : "",
      nw_config_date: dateOrEmpty(site.nw_config_date),
      tools_integration_done: site.tools_integration_done ? "true" : "",
      tools_integration_date: dateOrEmpty(site.tools_integration_date),
      mbss_done: site.mbss_done ? "true" : "",
      mbss_date: dateOrEmpty(site.mbss_date),
      vascan_done: site.vascan_done ? "true" : "",
      vascan_date: dateOrEmpty(site.vascan_date),
      installation_progress_status: site.installation_progress_status ?? "",
      installation_attachment_name: site.installation_attachment_name ?? "",
      installation_remarks: site.installation_remarks ?? "",
      tile_details: site.tile_details ?? "",
    } satisfies FormValues;
    loadedValuesRef.current = values;
    return { values };
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
        firmware_config_done: includeBios ? asBool(v.firmware_config_done) : false,
        firmware_config_date:
          includeBios && asBool(v.firmware_config_done)
            ? orNull(v.firmware_config_date)
            : null,
        lld_done: includeBios ? asBool(v.lld_done) : false,
        lld_date: includeBios && asBool(v.lld_done) ? orNull(v.lld_date) : null,
        os_installation_done: includeOs ? asBool(v.os_installation_done) : false,
        os_installation_date:
          includeOs && asBool(v.os_installation_done) ? orNull(v.os_installation_date) : null,
        vm_installation_done: includeOs ? asBool(v.vm_installation_done) : false,
        vm_installation_date:
          includeOs && asBool(v.vm_installation_done) ? orNull(v.vm_installation_date) : null,
        nw_config_done: includeOs ? asBool(v.nw_config_done) : false,
        nw_config_date:
          includeOs && asBool(v.nw_config_done) ? orNull(v.nw_config_date) : null,
        tools_integration_done: includeOs ? asBool(v.tools_integration_done) : false,
        tools_integration_date:
          includeOs && asBool(v.tools_integration_done)
            ? orNull(v.tools_integration_date)
            : null,
        mbss_done: includeOs ? asBool(v.mbss_done) : false,
        mbss_date: includeOs && asBool(v.mbss_done) ? orNull(v.mbss_date) : null,
        vascan_done: includeOs ? asBool(v.vascan_done) : false,
        vascan_date: includeOs && asBool(v.vascan_done) ? orNull(v.vascan_date) : null,
        installation_progress_status: orNull(v.installation_progress_status),
        installation_attachment_name: orNull(v.installation_attachment_name),
        installation_remarks: orNull(v.installation_remarks),
      });
      loadedValuesRef.current = v;

      if (isProgressCompleteForAdvance(v.installation_progress_status)) {
        await advanceSiteInstallation(
          projectId,
          deliveryType === "rack_only"
            ? "complete_installation_rack_only"
            : "complete_installation",
        );
      }

      return `/projects/my-jobs`;
    },
    [deliveryType, projectId],
  );

  const sections = useMemo<FormSection[]>(() => {
    const stackingLabel = isRackOnly
      ? "Rack Installation"
      : hasRack
        ? "Rack Installation + Server Stacking"
        : "Server Stacking";
    const stackingDateLabel = isRackOnly
      ? "Rack Installation Date"
      : hasRack
        ? "Rack + Stacking Date"
        : "Server Stacking Date";
    const installSubtitle = isRackOnly
      ? "Rack installation at site"
      : hasRack
        ? "Rack + stacking · Power on · DAC/ILO"
        : "Server stacking · Power on · DAC/ILO";

    const installFields: FormSection["fields"] = [
      {
        name: "rack_server_stacking_done",
        label: stackingLabel,
        type: "yesno",
        clearFieldsOnChange: ["rack_server_stacking_date"],
      },
      {
        name: "rack_server_stacking_date",
        label: stackingDateLabel,
        type: "date",
        required: true,
        visibleWhen: (v) => v.rack_server_stacking_done === "true",
      },
    ];

    if (!isRackOnly) {
      installFields.push(
        {
          name: "rack_server_power_on_done",
          label: hasRack ? "Rack + Server Power On" : "Server Power On",
          type: "yesno",
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
          type: "yesno",
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
      intakeSummarySection(),
      stageOwnerBannerSection(),
      {
        title: "Survey reference",
        subtitle: "Tile details captured during Survey (read-only).",
        icon: ClipboardList,
        fields: [
          {
            name: "tile_details",
            label: "Tile Details",
            type: "readonly",
            full: true,
          },
        ],
      },
      {
        title: "Installation",
        subtitle: installSubtitle,
        icon: Server,
        fields: installFields,
      },
    ];

    if (showBios || showOs) {
      const configFields: FormSection["fields"] = [];
      if (showBios) {
        configFields.push(
          {
            name: "lld_done",
            label: "LLD Availability",
            type: "yesno",
            clearFieldsOnChange: ["lld_date"],
          },
          {
            name: "lld_date",
            label: "LLD Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.lld_done === "true",
          },
          {
            name: "bios_configuration_done",
            label: "BIOS Configuration",
            type: "yesno",
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
            name: "firmware_config_done",
            label: "Firmware Configuration",
            type: "yesno",
            clearFieldsOnChange: ["firmware_config_date"],
          },
          {
            name: "firmware_config_date",
            label: "Firmware Configuration Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.firmware_config_done === "true",
          },
        );
      }
      if (showOs) {
        configFields.push(
          {
            name: "os_installation_done",
            label: "OS Installation",
            type: "yesno",
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
            name: "vm_installation_done",
            label: "VM Installation",
            type: "yesno",
            clearFieldsOnChange: ["vm_installation_date"],
          },
          {
            name: "vm_installation_date",
            label: "VM Installation Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.vm_installation_done === "true",
          },
          {
            name: "nw_config_done",
            label: "N/W Configuration",
            type: "yesno",
            clearFieldsOnChange: ["nw_config_date"],
          },
          {
            name: "nw_config_date",
            label: "N/W Configuration Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.nw_config_done === "true",
          },
          {
            name: "tools_integration_done",
            label: "Tools Integration",
            type: "yesno",
            clearFieldsOnChange: ["tools_integration_date"],
          },
          {
            name: "tools_integration_date",
            label: "Tools Integration Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.tools_integration_done === "true",
          },
          {
            name: "mbss_done",
            label: "MBSS",
            type: "yesno",
            clearFieldsOnChange: ["mbss_date"],
          },
          {
            name: "mbss_date",
            label: "MBSS Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.mbss_done === "true",
          },
          {
            name: "vascan_done",
            label: "VASCAN",
            type: "yesno",
            clearFieldsOnChange: ["vascan_date"],
          },
          {
            name: "vascan_date",
            label: "VASCAN Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.vascan_done === "true",
          },
        );
      }
      sectionsOut.push({
        title: "Configuration",
        subtitle: showOs
          ? "LLD · BIOS · Firmware · OS · VM · N/W · Tools · MBSS · VASCAN"
          : "LLD · BIOS · Firmware",
        icon: Wrench,
        fields: configFields,
      });
    }

    sectionsOut.push(
      ...stageClosingSections(
        "installation_progress_status",
        "installation_attachment_name",
        "installation_remarks",
        "Installation",
      ),
    );

    return sectionsOut;
  }, [hasRack, isRackOnly, showBios, showOs]);

  return (
    <ProjectsRecordForm
      title={isRackOnly ? "Installation" : "Installation & Configuration"}
      description={
        isRackOnly
          ? "Step 6 — Confirm rack installation, then continue to Acceptance."
          : "Step 6 — Installation and configuration in one step. Next: Acceptance."
      }
      backHref={
        stageFormMeta.readOnly
          ? (stageFormMeta.backHref ?? `/projects/projects/${projectId}`)
          : `/projects/my-jobs`
      }
      backLabel={
        stageFormMeta.readOnly
          ? (stageFormMeta.backLabel ?? "Back")
          : "Back to My Jobs"
      }
      readOnly={stageFormMeta.readOnly}
      readOnlyBanner={stageFormMeta.readOnlyBanner}
      submitLabel="Save"
      sections={sections}
      emptyValues={EMPTY}
      load={load}
      onSave={onSave}
      headerActions={
        stageFormMeta.readOnly ? (
          <SiteStageExportButton projectId={projectId} stage="installation" />
        ) : null
      }
    />
  );
}
