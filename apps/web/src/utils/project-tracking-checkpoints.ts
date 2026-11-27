import {
  deliveryIncludesBios,
  deliveryIncludesOs,
  deliveryIncludesRack,
  deliveryIncludesServer,
  deliveryIsRackOnly,
} from "@/components/projects/projects-domain";
import type { SiteInstallation } from "@/services/projects-portal-service";

export type TrackingCheckpointAnswer = "yes" | "no";

export type TrackingCheckpointRow = {
  /** Workflow stage key for Excel stage filters. */
  stageKey: string;
  step: string;
  checkpoint: string;
  answer: TrackingCheckpointAnswer;
  completedBy: string;
  yesClicked: string;
};

function displayDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value).slice(0, 16).replace("T", " ");
  }
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function yesClickedAt(
  site: SiteInstallation,
  ...fieldKeys: string[]
): string {
  const map = site.checkpoint_yes_at ?? {};
  for (const key of fieldKeys) {
    const raw = map[key];
    if (raw) return displayDateTime(raw);
  }
  return "-";
}

function assigneeLabel(
  site: SiteInstallation,
  stageKey: string,
  names: Record<string, string>,
): string {
  const fieldMap: Record<string, string | null | undefined> = {
    survey: site.survey_assignee_employee_id,
    scm: site.scm_assignee_employee_id,
    onsite_delivery:
      site.onsite_delivery_assignee_employee_id ?? site.onsite_assignee_employee_id,
    material_handover: site.material_handover_assignee_employee_id,
    installation: site.installation_assignee_employee_id,
    acceptance: site.acceptance_assignee_employee_id,
  };
  const id = fieldMap[stageKey];
  if (!id) return "Unassigned";
  const label = names[id];
  if (!label) return "Assigned";
  // Prefer name-only when roster labels are "Name (code)"
  const cut = label.indexOf(" (");
  return cut > 0 ? label.slice(0, cut).trim() : label;
}

/**
 * Checkpoint rows matching the Project Tracking table
 * (Step / Checkpoint / Yes-No / Completed By / Yes clicked).
 */
export function buildSiteTrackingCheckpointRows(opts: {
  site: SiteInstallation;
  employeeNames?: Record<string, string>;
  stageFilter?: string | null;
}): TrackingCheckpointRow[] {
  const { site, employeeNames = {}, stageFilter = null } = opts;
  const filter =
    stageFilter === "onsite" ? "onsite_delivery" : stageFilter || null;

  const rackOnly = deliveryIsRackOnly(site.delivery_type);
  const hasRack = deliveryIncludesRack(site.delivery_type);
  const hasServer = deliveryIncludesServer(site.delivery_type);
  const hasBios = deliveryIncludesBios(site.delivery_type);
  const hasOs = deliveryIncludesOs(site.delivery_type);
  const installStep = rackOnly ? "Installation" : "Installation & Configuration";
  const by = (stageKey: string) => assigneeLabel(site, stageKey, employeeNames);

  const rows: TrackingCheckpointRow[] = [];
  const push = (
    stageKey: string,
    step: string,
    checkpoint: string,
    answer: TrackingCheckpointAnswer,
    yesFieldKeys: string[],
  ) => {
    if (filter && filter !== stageKey) return;
    rows.push({
      stageKey,
      step,
      checkpoint,
      answer,
      completedBy: by(stageKey),
      yesClicked:
        answer === "yes" ? yesClickedAt(site, ...yesFieldKeys) : "-",
    });
  };

  push(
    "survey",
    "Survey",
    "Space Available",
    site.space_available ? "yes" : "no",
    ["space_available"],
  );
  push(
    "survey",
    "Survey",
    "Power Available",
    site.power_available ? "yes" : "no",
    ["power_available"],
  );
  push(
    "survey",
    "Survey",
    "Survey Completed",
    site.survey_completed ? "yes" : "no",
    ["survey_completed"],
  );

  push(
    "onsite_delivery",
    "Onsite Delivery",
    "MO Request",
    site.mo_request ? "yes" : "no",
    ["mo_request"],
  );

  push(
    "material_handover",
    "Material Handover",
    "IM Material",
    site.im_material ? "yes" : "no",
    ["im_material"],
  );
  push(
    "material_handover",
    "Material Handover",
    "Material Handover",
    site.material_handover_done ? "yes" : "no",
    ["material_handover_done"],
  );

  if (rackOnly || hasRack) {
    push(
      "installation",
      installStep,
      "Rack Installation",
      site.rack_installation_done || site.rack_server_stacking_done ? "yes" : "no",
      ["rack_installation_done", "rack_server_stacking_done"],
    );
  }
  if (!rackOnly) {
    push(
      "installation",
      installStep,
      "Server Stacking",
      site.server_stacking_done || site.rack_server_stacking_done ? "yes" : "no",
      ["server_stacking_done", "rack_server_stacking_done"],
    );
  }
  if (!rackOnly && hasServer) {
    if (hasRack) {
      push(
        "installation",
        installStep,
        "Rack Power On",
        site.rack_power_on_done || site.rack_server_power_on_done ? "yes" : "no",
        ["rack_power_on_done", "rack_server_power_on_done"],
      );
    }
    push(
      "installation",
      installStep,
      "Server Power On",
      site.server_power_on_done || site.rack_server_power_on_done ? "yes" : "no",
      ["server_power_on_done", "rack_server_power_on_done"],
    );
    push(
      "installation",
      installStep,
      "DAC / ILO Cabling",
      site.dac_ilo_cabling_done ? "yes" : "no",
      ["dac_ilo_cabling_done"],
    );
  }
  if (hasBios) {
    push(
      "installation",
      installStep,
      "LLD",
      site.lld_done ? "yes" : "no",
      ["lld_done"],
    );
    push(
      "installation",
      installStep,
      "BIOS Configuration",
      site.bios_configuration_done ? "yes" : "no",
      ["bios_configuration_done"],
    );
    push(
      "installation",
      installStep,
      "Firmware Configuration",
      site.firmware_config_done ? "yes" : "no",
      ["firmware_config_done"],
    );
  }
  if (hasOs) {
    push(
      "installation",
      installStep,
      "OS Installation",
      site.os_installation_done ? "yes" : "no",
      ["os_installation_done"],
    );
    push(
      "installation",
      installStep,
      "VM Installation",
      site.vm_installation_done ? "yes" : "no",
      ["vm_installation_done"],
    );
    push(
      "installation",
      installStep,
      "N/W Configuration",
      site.nw_config_done ? "yes" : "no",
      ["nw_config_done"],
    );
    push(
      "installation",
      installStep,
      "Tools Integration",
      site.tools_integration_done ? "yes" : "no",
      ["tools_integration_done"],
    );
    push(
      "installation",
      installStep,
      "MBSS",
      site.mbss_done ? "yes" : "no",
      ["mbss_done"],
    );
    push(
      "installation",
      installStep,
      "VASCAN",
      site.vascan_done ? "yes" : "no",
      ["vascan_done"],
    );
  }

  push(
    "acceptance",
    "Acceptance",
    "Handover to Application Team",
    site.handover_to_cloud_done ? "yes" : "no",
    ["handover_to_cloud_done"],
  );
  if (!rackOnly) {
    push(
      "acceptance",
      "Acceptance",
      "HW-AT Request",
      site.hwat_request_done ? "yes" : "no",
      ["hwat_request_done"],
    );
    push(
      "acceptance",
      "Acceptance",
      "HW-AT Sign-off",
      site.hwat_signoff_received ? "yes" : "no",
      ["hwat_signoff_received"],
    );
  }

  return rows;
}
