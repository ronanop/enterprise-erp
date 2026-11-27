"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ClipboardList, Package, Server, Wrench } from "lucide-react";

import {
  cloudPoLinesFullyInstalled,
  draftsFromCloudPoLines,
  draftsToCloudPoLines,
  parseCloudPoDeliveryDrafts,
  serializeCloudPoDeliveryDrafts,
} from "@/components/projects/cloud-po-delivery-lines";
import {
  linesFromMaterial,
  serializeTypeQtyLines,
} from "@/components/projects/material-type-qty-lines";
import {
  CABLE_TYPES,
  INDUSTRIAL_SOCKET_TYPES,
  LUG_TYPES,
  deliveryIncludesBios,
  deliveryIncludesOs,
  deliveryIncludesRack,
  deliveryIsRackOnly,
} from "@/components/projects/projects-domain";
import {
  ProjectsRecordForm,
  dateIfAnswered,
  orNull,
  yesNoFromBoolDate,
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

const EMPTY_LINES = serializeTypeQtyLines([
  { type: "", otherLabel: "", quantity: "", delivered: "", date: "" },
]);

const EMPTY: FormValues = {
  ...INTAKE_SUMMARY_EMPTY,
  delivery_type: "server_os_rack",
  stage_assignee_label: "",
  cloud_po_lines: "[]",
  cable_lines: EMPTY_LINES,
  socket_lines: EMPTY_LINES,
  lug_lines: EMPTY_LINES,
  rack_installation_done: "",
  rack_installation_date: "",
  server_stacking_done: "",
  server_stacking_date: "",
  rack_power_on_done: "",
  rack_power_on_date: "",
  server_power_on_done: "",
  server_power_on_date: "",
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

function laterDate(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  const left = a?.trim() || "";
  const right = b?.trim() || "";
  if (!left) return right || null;
  if (!right) return left || null;
  return left >= right ? left : right;
}

function isRack(values: FormValues): boolean {
  return deliveryIncludesRack(values.delivery_type);
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

    // Prefer split fields; fall back to legacy combined columns for older rows.
    const rackInstallDone =
      site.rack_installation_done || site.rack_server_stacking_done;
    const serverStackDone =
      site.server_stacking_done || site.rack_server_stacking_done;
    const rackPowerDone = site.rack_power_on_done || site.rack_server_power_on_done;
    const serverPowerDone =
      site.server_power_on_done || site.rack_server_power_on_done;

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
      cloud_po_lines: serializeCloudPoDeliveryDrafts(draftsFromCloudPoLines(site)),
      cable_lines: serializeTypeQtyLines(
        linesFromMaterial(site.cable_lines, CABLE_TYPES),
      ),
      socket_lines: serializeTypeQtyLines(
        linesFromMaterial(site.industrial_socket_lines, INDUSTRIAL_SOCKET_TYPES),
      ),
      lug_lines: serializeTypeQtyLines(
        linesFromMaterial(site.lug_lines, LUG_TYPES),
      ),
      rack_installation_done: yesNoFromBoolDate(
        rackInstallDone,
        site.rack_installation_date ?? site.rack_server_stacking_date,
      ),
      rack_installation_date: dateOrEmpty(
        site.rack_installation_date ?? site.rack_server_stacking_date,
      ),
      server_stacking_done: yesNoFromBoolDate(
        serverStackDone,
        site.server_stacking_date ?? site.rack_server_stacking_date,
      ),
      server_stacking_date: dateOrEmpty(
        site.server_stacking_date ?? site.rack_server_stacking_date,
      ),
      rack_power_on_done: yesNoFromBoolDate(
        rackPowerDone,
        site.rack_power_on_date ?? site.rack_server_power_on_date,
      ),
      rack_power_on_date: dateOrEmpty(
        site.rack_power_on_date ?? site.rack_server_power_on_date,
      ),
      server_power_on_done: yesNoFromBoolDate(
        serverPowerDone,
        site.server_power_on_date ?? site.rack_server_power_on_date,
      ),
      server_power_on_date: dateOrEmpty(
        site.server_power_on_date ?? site.rack_server_power_on_date,
      ),
      dac_ilo_cabling_done: yesNoFromBoolDate(
        site.dac_ilo_cabling_done,
        site.dac_ilo_cabling_date,
      ),
      dac_ilo_cabling_date: dateOrEmpty(site.dac_ilo_cabling_date),
      bios_configuration_done: yesNoFromBoolDate(
        site.bios_configuration_done,
        site.bios_configuration_date,
      ),
      bios_configuration_date: dateOrEmpty(site.bios_configuration_date),
      firmware_config_done: yesNoFromBoolDate(
        site.firmware_config_done,
        site.firmware_config_date,
      ),
      firmware_config_date: dateOrEmpty(site.firmware_config_date),
      lld_done: yesNoFromBoolDate(site.lld_done, site.lld_date),
      lld_date: dateOrEmpty(site.lld_date),
      os_installation_done: yesNoFromBoolDate(
        site.os_installation_done,
        site.os_installation_date,
      ),
      os_installation_date: dateOrEmpty(site.os_installation_date),
      vm_installation_done: yesNoFromBoolDate(
        site.vm_installation_done,
        site.vm_installation_date,
      ),
      vm_installation_date: dateOrEmpty(site.vm_installation_date),
      nw_config_done: yesNoFromBoolDate(site.nw_config_done, site.nw_config_date),
      nw_config_date: dateOrEmpty(site.nw_config_date),
      tools_integration_done: yesNoFromBoolDate(
        site.tools_integration_done,
        site.tools_integration_date,
      ),
      tools_integration_date: dateOrEmpty(site.tools_integration_date),
      mbss_done: yesNoFromBoolDate(site.mbss_done, site.mbss_date),
      mbss_date: dateOrEmpty(site.mbss_date),
      vascan_done: yesNoFromBoolDate(site.vascan_done, site.vascan_date),
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
      const includeRack = deliveryIncludesRack(type);
      const includeOs = deliveryIncludesOs(type);
      const includeBios = deliveryIncludesBios(type);
      const drafts = parseCloudPoDeliveryDrafts(v.cloud_po_lines);
      const fullyInstalled = cloudPoLinesFullyInstalled(drafts);

      if (
        isProgressCompleteForAdvance(v.installation_progress_status) &&
        !fullyInstalled
      ) {
        throw new Error(
          "Cannot mark Installation Completed until every PO quantity is installed. Use Partial completed for this delivery wave.",
        );
      }

      const rackInstall = rackOnly || includeRack ? asBool(v.rack_installation_done) : false;
      const rackInstallDate =
        rackOnly || includeRack
          ? dateIfAnswered(v.rack_installation_done, v.rack_installation_date)
          : null;
      const serverStack = rackOnly ? false : asBool(v.server_stacking_done);
      const serverStackDate = rackOnly
        ? null
        : dateIfAnswered(v.server_stacking_done, v.server_stacking_date);
      const rackPower = rackOnly || !includeRack ? false : asBool(v.rack_power_on_done);
      const rackPowerDate =
        rackOnly || !includeRack
          ? null
          : dateIfAnswered(v.rack_power_on_done, v.rack_power_on_date);
      const serverPower = rackOnly ? false : asBool(v.server_power_on_done);
      const serverPowerDate = rackOnly
        ? null
        : dateIfAnswered(v.server_power_on_done, v.server_power_on_date);

      // Keep legacy combined columns in sync for older readers / exports.
      const legacyStackingDone = rackOnly
        ? rackInstall
        : includeRack
          ? rackInstall && serverStack
          : serverStack;
      const legacyStackingDate = rackOnly
        ? rackInstallDate
        : includeRack
          ? laterDate(rackInstallDate, serverStackDate)
          : serverStackDate;
      const legacyPowerDone = rackOnly
        ? false
        : includeRack
          ? rackPower && serverPower
          : serverPower;
      const legacyPowerDate = rackOnly
        ? null
        : includeRack
          ? laterDate(rackPowerDate, serverPowerDate)
          : serverPowerDate;

      await updateSiteInstallationByProject(projectId, {
        cloud_po_lines: draftsToCloudPoLines(drafts),
        rack_installation_done: rackInstall,
        rack_installation_date: rackInstallDate,
        server_stacking_done: serverStack,
        server_stacking_date: serverStackDate,
        rack_power_on_done: rackPower,
        rack_power_on_date: rackPowerDate,
        server_power_on_done: serverPower,
        server_power_on_date: serverPowerDate,
        rack_server_stacking_done: legacyStackingDone,
        rack_server_stacking_date: legacyStackingDate,
        rack_server_power_on_done: legacyPowerDone,
        rack_server_power_on_date: legacyPowerDate,
        dac_ilo_cabling_done: rackOnly ? false : asBool(v.dac_ilo_cabling_done),
        dac_ilo_cabling_date: rackOnly
          ? null
          : dateIfAnswered(v.dac_ilo_cabling_done, v.dac_ilo_cabling_date),
        bios_configuration_done: includeBios ? asBool(v.bios_configuration_done) : false,
        bios_configuration_date: includeBios
          ? dateIfAnswered(v.bios_configuration_done, v.bios_configuration_date)
          : null,
        firmware_config_done: includeBios ? asBool(v.firmware_config_done) : false,
        firmware_config_date: includeBios
          ? dateIfAnswered(v.firmware_config_done, v.firmware_config_date)
          : null,
        lld_done: includeBios ? asBool(v.lld_done) : false,
        lld_date: includeBios ? dateIfAnswered(v.lld_done, v.lld_date) : null,
        os_installation_done: includeOs ? asBool(v.os_installation_done) : false,
        os_installation_date: includeOs
          ? dateIfAnswered(v.os_installation_done, v.os_installation_date)
          : null,
        vm_installation_done: includeOs ? asBool(v.vm_installation_done) : false,
        vm_installation_date: includeOs
          ? dateIfAnswered(v.vm_installation_done, v.vm_installation_date)
          : null,
        nw_config_done: includeOs ? asBool(v.nw_config_done) : false,
        nw_config_date: includeOs
          ? dateIfAnswered(v.nw_config_done, v.nw_config_date)
          : null,
        tools_integration_done: includeOs ? asBool(v.tools_integration_done) : false,
        tools_integration_date: includeOs
          ? dateIfAnswered(v.tools_integration_done, v.tools_integration_date)
          : null,
        mbss_done: includeOs ? asBool(v.mbss_done) : false,
        mbss_date: includeOs ? dateIfAnswered(v.mbss_done, v.mbss_date) : null,
        vascan_done: includeOs ? asBool(v.vascan_done) : false,
        vascan_date: includeOs ? dateIfAnswered(v.vascan_done, v.vascan_date) : null,
        installation_progress_status: orNull(v.installation_progress_status),
        installation_attachment_name: orNull(v.installation_attachment_name),
        installation_remarks: orNull(v.installation_remarks),
      });
      loadedValuesRef.current = v;

      if (
        isProgressCompleteForAdvance(v.installation_progress_status) &&
        fullyInstalled
      ) {
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
    const installSubtitle = isRackOnly
      ? "Rack installation at site"
      : hasRack
        ? "Rack · Stacking · Power on · DAC/ILO"
        : "Server stacking · Power on · DAC/ILO";

    const installFields: FormSection["fields"] = [];

    if (isRackOnly || hasRack) {
      installFields.push(
        {
          name: "rack_installation_done",
          label: "Rack Installation",
          type: "yesno",
          clearFieldsOnChange: ["rack_installation_date"],
        },
        {
          name: "rack_installation_date",
          label: "Rack Installation Date",
          type: "date",
          required: true,
          visibleWhen: (v) => v.rack_installation_done === "true",
        },
      );
    }

    if (!isRackOnly) {
      installFields.push(
        {
          name: "server_stacking_done",
          label: "Server Stacking",
          type: "yesno",
          clearFieldsOnChange: ["server_stacking_date"],
        },
        {
          name: "server_stacking_date",
          label: "Server Stacking Date",
          type: "date",
          required: true,
          visibleWhen: (v) => v.server_stacking_done === "true",
        },
      );

      if (hasRack) {
        installFields.push(
          {
            name: "rack_power_on_done",
            label: "Rack Power On",
            type: "yesno",
            clearFieldsOnChange: ["rack_power_on_date"],
          },
          {
            name: "rack_power_on_date",
            label: "Rack Power On Date",
            type: "date",
            required: true,
            visibleWhen: (v) => v.rack_power_on_done === "true",
          },
        );
      }

      installFields.push(
        {
          name: "server_power_on_done",
          label: "Server Power On",
          type: "yesno",
          clearFieldsOnChange: ["server_power_on_date"],
        },
        {
          name: "server_power_on_date",
          label: "Server Power On Date",
          type: "date",
          required: true,
          visibleWhen: (v) => v.server_power_on_done === "true",
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
        title: "Installation quantities",
        subtitle:
          "Install only what is on site for this wave. Remaining PO qty stays open for later SCM → Onsite → Install waves. Use Partial completed until every line is fully installed.",
        icon: Package,
        fields: [
          {
            name: "cloud_po_lines",
            label: "Type / Qty installation",
            type: "cloud_po_lines",
            deliveryMode: "install",
            full: true,
          },
          {
            name: "cable_lines",
            label: "Cable",
            type: "type_qty_lines",
            full: true,
            showDate: true,
            datesOnly: true,
            readOnly: true,
            options: CABLE_TYPES,
            visibleWhen: isRack,
          },
          {
            name: "socket_lines",
            label: "Industrial Socket",
            type: "type_qty_lines",
            full: true,
            showDate: true,
            datesOnly: true,
            readOnly: true,
            options: INDUSTRIAL_SOCKET_TYPES,
            visibleWhen: isRack,
          },
          {
            name: "lug_lines",
            label: "Lugs",
            type: "type_qty_lines",
            full: true,
            showDate: true,
            datesOnly: true,
            readOnly: true,
            options: LUG_TYPES,
            visibleWhen: isRack,
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
          ? "Step 6 - Confirm rack installation, then continue to Acceptance."
          : "Step 6 - Installation and configuration in one step. Next: Acceptance."
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
