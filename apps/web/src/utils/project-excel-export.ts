import { siteWorkflowStageLabel } from "@/components/projects/projects-domain";
import { downloadXlsxMatrix, type SpreadsheetCellValue } from "@/lib/spreadsheet";
import type {
  Project,
  SiteInstallation,
  SiteInstallationBlueprint,
} from "@/services/projects-portal-service";

export type CheckpointAnswer = "yes" | "no";

export type ProjectExportCheckpoint = {
  step: string;
  checkpoint: string;
  completedBy: string;
  dateCompleted: string;
  value?: string;
  answer: CheckpointAnswer;
};

const YES_BG = "#BBF7D0";
const YES_FG = "#14532D";
const NO_BG = "#FECACA";
const NO_FG = "#7F1D1D";

function displayDate(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function yn(flag: boolean | null | undefined, date?: string | null): string {
  if (flag === true) {
    const d = displayDate(date);
    return d ? `Yes (${d})` : "Yes";
  }
  return "No";
}

function answerFromFlag(flag: boolean | null | undefined): CheckpointAnswer {
  return flag === true ? "yes" : "no";
}

function answerFromDate(date: string | null | undefined): CheckpointAnswer {
  return date ? "yes" : "no";
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

function colored(value: string, answer: CheckpointAnswer): SpreadsheetCellValue {
  const yes = answer === "yes";
  return {
    value,
    backgroundColor: yes ? YES_BG : NO_BG,
    textColor: yes ? YES_FG : NO_FG,
    fontWeight: "bold",
    align: "left",
  };
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
    answer: CheckpointAnswer,
    value?: string,
  ) => {
    if (stageFilter && stageFilter !== stepKey) return;
    rows.push({
      step: siteWorkflowStageLabel(stepKey),
      checkpoint,
      completedBy: by(stepKey),
      dateCompleted: displayDate(dateCompleted),
      value: value ?? (answer === "yes" ? "Yes" : "No"),
      answer,
    });
  };

  push(
    "survey",
    "Space Available",
    site.space_available_date,
    answerFromFlag(site.space_available),
    yn(site.space_available, site.space_available_date),
  );
  push(
    "survey",
    "Power Available",
    site.power_available_date,
    answerFromFlag(site.power_available),
    yn(site.power_available, site.power_available_date),
  );
  push(
    "survey",
    "Tile Details",
    site.survey_completed_date,
    site.tile_details?.trim() ? "yes" : "no",
    site.tile_details ?? "",
  );
  push(
    "survey",
    "Survey Completed",
    site.survey_completed_date,
    answerFromFlag(site.survey_completed),
    yn(site.survey_completed, site.survey_completed_date),
  );
  push(
    "survey",
    "Progress",
    site.survey_finished_date,
    site.survey_progress_status ? "yes" : "no",
    site.survey_progress_status ?? "",
  );

  push(
    "scm",
    "Server WH Delivery",
    site.server_wh_delivery_date,
    answerFromDate(site.server_wh_delivery_date),
  );
  push(
    "scm",
    "Rack WH Delivery",
    site.rack_wh_delivery_date,
    answerFromDate(site.rack_wh_delivery_date),
  );
  push(
    "scm",
    "PDU WH Delivery",
    site.pdu_wh_delivery_date,
    answerFromDate(site.pdu_wh_delivery_date),
  );
  push(
    "scm",
    "Progress",
    site.scm_finished_date,
    site.scm_progress_status ? "yes" : "no",
    site.scm_progress_status ?? "",
  );

  push(
    "onsite_delivery",
    "MO Request",
    site.mo_request_date,
    answerFromFlag(site.mo_request),
    yn(site.mo_request, site.mo_request_date),
  );
  push(
    "onsite_delivery",
    "Server On-site Delivery",
    site.server_on_site_delivery_date,
    answerFromDate(site.server_on_site_delivery_date),
  );
  push(
    "onsite_delivery",
    "Rack On-site Delivery",
    site.rack_on_site_delivery_date,
    answerFromDate(site.rack_on_site_delivery_date),
  );
  push(
    "onsite_delivery",
    "PDU On-site Delivery",
    site.pdu_on_site_delivery_date,
    answerFromDate(site.pdu_on_site_delivery_date),
  );
  push(
    "onsite_delivery",
    "Progress",
    site.onsite_delivery_finished_date ?? site.onsite_finished_date,
    site.onsite_delivery_progress_status || site.onsite_progress_status ? "yes" : "no",
    site.onsite_delivery_progress_status ?? site.onsite_progress_status ?? "",
  );

  push(
    "material_handover",
    "IM Material",
    site.im_material_date,
    answerFromFlag(site.im_material),
    yn(site.im_material, site.im_material_date),
  );
  push(
    "material_handover",
    "Power-on Material",
    site.power_on_material_date,
    answerFromFlag(site.power_on_material),
    yn(site.power_on_material, site.power_on_material_date),
  );
  push(
    "material_handover",
    "Material Handover (WH → Site)",
    site.material_handover_date,
    answerFromFlag(site.material_handover_done),
    yn(site.material_handover_done, site.material_handover_date),
  );
  push(
    "material_handover",
    "Handed Over To",
    site.material_handover_date,
    site.material_handover_to_name?.trim() ? "yes" : "no",
    site.material_handover_to_name ?? "",
  );
  push(
    "material_handover",
    "Progress",
    site.material_handover_finished_date,
    site.material_handover_progress_status ? "yes" : "no",
    site.material_handover_progress_status ?? "",
  );

  push(
    "installation",
    "Rack / Server Stacking",
    site.rack_server_stacking_date,
    answerFromFlag(site.rack_server_stacking_done),
    yn(site.rack_server_stacking_done, site.rack_server_stacking_date),
  );
  push(
    "installation",
    "Power On",
    site.rack_server_power_on_date,
    answerFromFlag(site.rack_server_power_on_done),
    yn(site.rack_server_power_on_done, site.rack_server_power_on_date),
  );
  push(
    "installation",
    "DAC / ILO Cabling",
    site.dac_ilo_cabling_date,
    answerFromFlag(site.dac_ilo_cabling_done),
    yn(site.dac_ilo_cabling_done, site.dac_ilo_cabling_date),
  );
  push(
    "installation",
    "LLD",
    site.lld_date,
    answerFromFlag(site.lld_done),
    yn(site.lld_done, site.lld_date),
  );
  push(
    "installation",
    "BIOS Configuration",
    site.bios_configuration_date,
    answerFromFlag(site.bios_configuration_done),
    yn(site.bios_configuration_done, site.bios_configuration_date),
  );
  push(
    "installation",
    "Firmware Configuration",
    site.firmware_config_date,
    answerFromFlag(site.firmware_config_done),
    yn(site.firmware_config_done, site.firmware_config_date),
  );
  push(
    "installation",
    "OS Installation",
    site.os_installation_date,
    answerFromFlag(site.os_installation_done),
    yn(site.os_installation_done, site.os_installation_date),
  );
  push(
    "installation",
    "VM Installation",
    site.vm_installation_date,
    answerFromFlag(site.vm_installation_done),
    yn(site.vm_installation_done, site.vm_installation_date),
  );
  push(
    "installation",
    "N/W Configuration",
    site.nw_config_date,
    answerFromFlag(site.nw_config_done),
    yn(site.nw_config_done, site.nw_config_date),
  );
  push(
    "installation",
    "Tools Integration",
    site.tools_integration_date,
    answerFromFlag(site.tools_integration_done),
    yn(site.tools_integration_done, site.tools_integration_date),
  );
  push(
    "installation",
    "MBSS",
    site.mbss_date,
    answerFromFlag(site.mbss_done),
    yn(site.mbss_done, site.mbss_date),
  );
  push(
    "installation",
    "VASCAN",
    site.vascan_date,
    answerFromFlag(site.vascan_done),
    yn(site.vascan_done, site.vascan_date),
  );
  push(
    "installation",
    "Progress",
    site.installation_finished_date,
    site.installation_progress_status ? "yes" : "no",
    site.installation_progress_status ?? "",
  );

  push(
    "acceptance",
    "Handover to Application Team",
    site.handover_to_cloud_date,
    answerFromFlag(site.handover_to_cloud_done),
    yn(site.handover_to_cloud_done, site.handover_to_cloud_date),
  );
  push(
    "acceptance",
    "HW-AT Request",
    site.hwat_request_date,
    answerFromFlag(site.hwat_request_done),
    yn(site.hwat_request_done, site.hwat_request_date),
  );
  push(
    "acceptance",
    "HW-AT Sign-off",
    site.hwat_signoff_date,
    answerFromFlag(site.hwat_signoff_received),
    yn(site.hwat_signoff_received, site.hwat_signoff_date),
  );
  push(
    "acceptance",
    "Progress",
    site.acceptance_finished_date,
    site.acceptance_progress_status ? "yes" : "no",
    site.acceptance_progress_status ?? "",
  );

  return rows;
}

function toSheetData(rows: ProjectExportCheckpoint[]): SpreadsheetCellValue[][] {
  const header: SpreadsheetCellValue[] = [
    { value: "Step", fontWeight: "bold" },
    { value: "Checkpoint", fontWeight: "bold" },
    { value: "Status", fontWeight: "bold" },
    { value: "Completed By", fontWeight: "bold" },
    { value: "Date Completed", fontWeight: "bold" },
    { value: "Value", fontWeight: "bold" },
  ];
  return [
    header,
    ...rows.map((r) => [
      r.step,
      colored(r.checkpoint, r.answer),
      colored(r.answer === "yes" ? "Yes" : "No", r.answer),
      r.completedBy,
      r.dateCompleted || "—",
      colored(r.value || (r.answer === "yes" ? "Yes" : "No"), r.answer),
    ]),
  ];
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
  await downloadXlsxMatrix(`${code}-${label}-export.xlsx`, [
    { name: label.slice(0, 31) || "Stage", data: toSheetData(rows) },
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
  await downloadXlsxMatrix(`${code}-project-export.xlsx`, [
    { name: "Checkpoints", data: toSheetData(rows) },
  ]);
}
