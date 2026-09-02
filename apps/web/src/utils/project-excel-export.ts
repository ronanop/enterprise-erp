import { siteWorkflowStageLabel } from "@/components/projects/projects-domain";
import { downloadXlsx, type SpreadsheetRow } from "@/lib/spreadsheet";
import type {
  Project,
  SiteInstallation,
  SiteInstallationBlueprint,
} from "@/services/projects-portal-service";

export type ProjectExportCheckpoint = {
  step: string;
  checkpoint: string;
  completedBy: string;
  dateCompleted: string;
  value?: string;
};

function displayDate(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function yn(flag: boolean | null | undefined, date?: string | null): string {
  if (!flag) return "No";
  const d = displayDate(date);
  return d ? `Yes (${d})` : "Yes";
}

function assigneeLabel(
  site: SiteInstallation,
  stage: string,
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
  const id = fieldMap[stage];
  if (!id) return "Unassigned";
  return names[id] ?? "Assigned";
}

/** Build checkpoint-style rows for one stage or the whole project. */
export function buildProjectCheckpointRows(opts: {
  site: SiteInstallation;
  blueprint?: SiteInstallationBlueprint | null;
  employeeNames?: Record<string, string>;
  stageFilter?: string | null;
}): ProjectExportCheckpoint[] {
  const { site, employeeNames = {}, stageFilter = null } = opts;
  const rows: ProjectExportCheckpoint[] = [];
  const by = (stage: string) => assigneeLabel(site, stage, employeeNames);
  const push = (
    stepKey: string,
    checkpoint: string,
    dateCompleted: string | null | undefined,
    value?: string,
  ) => {
    if (stageFilter && stageFilter !== stepKey) return;
    rows.push({
      step: siteWorkflowStageLabel(stepKey),
      checkpoint,
      completedBy: by(stepKey),
      dateCompleted: displayDate(dateCompleted),
      value: value ?? "",
    });
  };

  push("survey", "Space Available", site.space_available_date, yn(site.space_available, site.space_available_date));
  push("survey", "Power Available", site.power_available_date, yn(site.power_available, site.power_available_date));
  push("survey", "Tile Details", site.survey_completed_date, site.tile_details ?? "");
  push("survey", "Survey Completed", site.survey_completed_date, yn(site.survey_completed, site.survey_completed_date));
  push("survey", "Progress", site.survey_finished_date, site.survey_progress_status ?? "");

  push("scm", "Server WH Delivery", site.server_wh_delivery_date);
  push("scm", "Rack WH Delivery", site.rack_wh_delivery_date);
  push("scm", "PDU WH Delivery", site.pdu_wh_delivery_date);
  push("scm", "Progress", site.scm_finished_date, site.scm_progress_status ?? "");

  push("onsite_delivery", "MO Request", site.mo_request_date, yn(site.mo_request, site.mo_request_date));
  push("onsite_delivery", "Server On-site Delivery", site.server_on_site_delivery_date);
  push("onsite_delivery", "Rack On-site Delivery", site.rack_on_site_delivery_date);
  push("onsite_delivery", "PDU On-site Delivery", site.pdu_on_site_delivery_date);
  push(
    "onsite_delivery",
    "Progress",
    site.onsite_delivery_finished_date ?? site.onsite_finished_date,
    site.onsite_delivery_progress_status ?? site.onsite_progress_status ?? "",
  );

  push("material_handover", "IM Material", site.im_material_date, yn(site.im_material, site.im_material_date));
  push(
    "material_handover",
    "Power-on Material",
    site.power_on_material_date,
    yn(site.power_on_material, site.power_on_material_date),
  );
  push(
    "material_handover",
    "Material Handover (WH → Site)",
    site.material_handover_date,
    yn(site.material_handover_done, site.material_handover_date),
  );
  push("material_handover", "Handed Over To", site.material_handover_date, site.material_handover_to_name ?? "");
  push(
    "material_handover",
    "Progress",
    site.material_handover_finished_date,
    site.material_handover_progress_status ?? "",
  );

  push("installation", "Rack / Server Stacking", site.rack_server_stacking_date, yn(site.rack_server_stacking_done, site.rack_server_stacking_date));
  push("installation", "Power On", site.rack_server_power_on_date, yn(site.rack_server_power_on_done, site.rack_server_power_on_date));
  push("installation", "DAC / ILO Cabling", site.dac_ilo_cabling_date, yn(site.dac_ilo_cabling_done, site.dac_ilo_cabling_date));
  push("installation", "BIOS Configuration", site.bios_configuration_date, yn(site.bios_configuration_done, site.bios_configuration_date));
  push("installation", "Firmware Configuration", site.firmware_config_date, yn(site.firmware_config_done, site.firmware_config_date));
  push("installation", "LLD", site.lld_date, yn(site.lld_done, site.lld_date));
  push("installation", "OS Installation", site.os_installation_date, yn(site.os_installation_done, site.os_installation_date));
  push("installation", "VM Installation", site.vm_installation_date, yn(site.vm_installation_done, site.vm_installation_date));
  push("installation", "N/W Configuration", site.nw_config_date, yn(site.nw_config_done, site.nw_config_date));
  push("installation", "Tools Integration", site.tools_integration_date, yn(site.tools_integration_done, site.tools_integration_date));
  push("installation", "MBSS", site.mbss_date, yn(site.mbss_done, site.mbss_date));
  push("installation", "VASCAN", site.vascan_date, yn(site.vascan_done, site.vascan_date));
  push("installation", "Progress", site.installation_finished_date, site.installation_progress_status ?? "");

  push("acceptance", "Handover to Application Team", site.handover_to_cloud_date, yn(site.handover_to_cloud_done, site.handover_to_cloud_date));
  push("acceptance", "HW-AT Request", site.hwat_request_date, yn(site.hwat_request_done, site.hwat_request_date));
  push("acceptance", "HW-AT Sign-off", site.hwat_signoff_date, yn(site.hwat_signoff_received, site.hwat_signoff_date));
  push("acceptance", "Progress", site.acceptance_finished_date, site.acceptance_progress_status ?? "");

  return rows;
}

function toSheetRows(rows: ProjectExportCheckpoint[]): SpreadsheetRow[] {
  return rows.map((r) => ({
    Step: r.step,
    Checkpoint: r.checkpoint,
    "Completed By": r.completedBy,
    "Date Completed": r.dateCompleted,
    Value: r.value ?? "",
  }));
}

export async function exportProjectStageExcel(opts: {
  project: Project;
  site: SiteInstallation;
  stage: string;
  employeeNames?: Record<string, string>;
  blueprint?: SiteInstallationBlueprint | null;
}) {
  const stageKey = opts.stage === "onsite" ? "onsite_delivery" : opts.stage;
  const rows = buildProjectCheckpointRows({
    site: opts.site,
    blueprint: opts.blueprint,
    employeeNames: opts.employeeNames,
    stageFilter: stageKey,
  });
  const label = siteWorkflowStageLabel(stageKey).replace(/[^\w\- ]+/g, "");
  const code = opts.project.project_code || "project";
  await downloadXlsx(`${code}-${label}-export.xlsx`, [
    { name: label.slice(0, 31) || "Stage", rows: toSheetRows(rows) },
  ]);
}

export async function exportWholeProjectExcel(opts: {
  project: Project;
  site: SiteInstallation;
  employeeNames?: Record<string, string>;
  blueprint?: SiteInstallationBlueprint | null;
}) {
  const rows = buildProjectCheckpointRows({
    site: opts.site,
    blueprint: opts.blueprint,
    employeeNames: opts.employeeNames,
    stageFilter: null,
  });
  const code = opts.project.project_code || "project";
  await downloadXlsx(`${code}-project-export.xlsx`, [
    { name: "Checkpoints", rows: toSheetRows(rows) },
  ]);
}
