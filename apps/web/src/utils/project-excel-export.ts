import { siteWorkflowStageLabel } from "@/components/projects/projects-domain";
import { downloadXlsxMatrix, type SpreadsheetCellValue } from "@/lib/spreadsheet";
import type {
  Project,
  SiteInstallation,
  SiteInstallationBlueprint,
} from "@/services/projects-portal-service";
import {
  buildSiteTrackingCheckpointRows,
  type TrackingCheckpointAnswer,
  type TrackingCheckpointRow,
} from "@/utils/project-tracking-checkpoints";

export type CheckpointAnswer = TrackingCheckpointAnswer;

export type ProjectExportCheckpoint = {
  step: string;
  checkpoint: string;
  completedBy: string;
  yesClicked: string;
  answer: CheckpointAnswer;
};

const YES_BG = "#BBF7D0";
const YES_FG = "#14532D";
const NO_BG = "#FECACA";
const NO_FG = "#7F1D1D";

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

/** Build checkpoint rows matching the Project Tracking table. */
export function buildProjectCheckpointRows(opts: {
  site: SiteInstallation;
  blueprint?: SiteInstallationBlueprint | null;
  employeeNames?: Record<string, string>;
  stageFilter?: string | null;
}): ProjectExportCheckpoint[] {
  return buildSiteTrackingCheckpointRows({
    site: opts.site,
    employeeNames: opts.employeeNames,
    stageFilter: opts.stageFilter,
  }).map((r: TrackingCheckpointRow) => ({
    step: r.step,
    checkpoint: r.checkpoint,
    completedBy: r.completedBy,
    yesClicked: r.yesClicked,
    answer: r.answer,
  }));
}

function toSheetData(rows: ProjectExportCheckpoint[]): SpreadsheetCellValue[][] {
  const header: SpreadsheetCellValue[] = [
    { value: "Step", fontWeight: "bold" },
    { value: "Checkpoint", fontWeight: "bold" },
    { value: "Yes / No", fontWeight: "bold" },
    { value: "Completed By", fontWeight: "bold" },
    { value: "Yes clicked", fontWeight: "bold" },
  ];
  return [
    header,
    ...rows.map((r) => [
      r.step,
      colored(r.checkpoint, r.answer),
      colored(r.answer === "yes" ? "Yes" : "No", r.answer),
      r.completedBy,
      r.yesClicked || "-",
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
