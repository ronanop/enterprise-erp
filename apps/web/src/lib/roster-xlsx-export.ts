import writeExcelFile, { type Cell, type Sheet } from "write-excel-file/browser";
import dataValidation, {
  type DataValidationSheetOptions,
} from "@onparallel/write-excel-file-data-validation";

import { downloadBlob } from "@/lib/spreadsheet";
import {
  buildManagerRosterExportData,
  type ManagerRosterExportData,
  type ShiftRosterDirectory,
} from "@/services/shift-roster-service";

const TEAL = "#0f766e";
const TEAL_LIGHT = "#ccfbf1";
const SLATE_50 = "#f8fafc";
const SLATE_200 = "#e2e8f0";
const AMBER_100 = "#fef3c7";
const INK = "#0f172a";
const MUTED = "#64748b";

function textCell(
  value: string,
  style?: Record<string, unknown>,
): Cell {
  return { value, type: String, ...style };
}

function dayCellStyle(code: string, dir: ShiftRosterDirectory): Record<string, unknown> {
  const c = (code || "").trim().toUpperCase();
  const base = { align: "center" as const, fontWeight: "bold" as const };
  if (!c) return { ...base, backgroundColor: "#ffffff" };
  if (c === "WO") return { ...base, backgroundColor: SLATE_200, textColor: MUTED };
  if (c === "HO") return { ...base, backgroundColor: AMBER_100, textColor: "#92400e" };
  const sh = dir.shifts.find((s) => s.shiftCode.toUpperCase() === c);
  const bg = sh?.extension?.color || TEAL_LIGHT;
  return { ...base, backgroundColor: bg, textColor: INK };
}

function buildRosterSheet(
  data: ManagerRosterExportData,
  dir: ShiftRosterDirectory,
): Cell[][] {
  const headerStyle = {
    backgroundColor: TEAL,
    textColor: "#ffffff",
    fontWeight: "bold" as const,
    align: "center" as const,
    wrap: true,
  };
  const metaStyle = {
    backgroundColor: SLATE_50,
    textColor: MUTED,
    fontWeight: "bold" as const,
    fontSize: 10,
  };
  const lockStyle = { backgroundColor: "#f1f5f9", textColor: INK };

  const shiftLegend = data.activeShifts.length
    ? data.activeShifts.map((s) => `${s.shiftCode}=${s.shiftName}`).join(" · ")
  : "(configure shifts in Shift master)";

  const rows: Cell[][] = [
    [
      textCell(
        `Roster month ${data.month} — use the dropdown on each day cell (shift code, WO, HO, or leave blank)`,
        metaStyle,
      ),
    ],
    [textCell("WO = weekly off · HO = holiday · blank = clear override", metaStyle)],
    [textCell(`Shifts: ${shiftLegend}`, metaStyle)],
    [
      textCell("manager_code", headerStyle),
      textCell("manager_name", headerStyle),
      textCell("month", headerStyle),
      textCell("employee_code", headerStyle),
      textCell("employee_name", headerStyle),
      textCell("department", headerStyle),
      ...data.dayHeaders.map((h) => textCell(h, headerStyle)),
    ],
  ];

  for (const emp of data.rows) {
    rows.push([
      textCell(data.manager.code, lockStyle),
      textCell(data.manager.label, lockStyle),
      textCell(data.month, lockStyle),
      textCell(emp.code, lockStyle),
      textCell(emp.name, lockStyle),
      textCell(emp.department, lockStyle),
      ...emp.dayValues.map((v) => textCell(v, dayCellStyle(v, dir))),
    ]);
  }

  return rows;
}

function buildListsSheet(codes: string[]): Cell[][] {
  return [
    [textCell("shift_code", { fontWeight: "bold", backgroundColor: TEAL, textColor: "#fff" })],
    ...codes.map((c) => [textCell(c, { align: "center" })]),
  ];
}

export async function downloadManagerRosterXlsx(
  dir: ShiftRosterDirectory,
  managerId: string,
  month: string,
): Promise<{ teamCount: number; filename: string }> {
  const data = buildManagerRosterExportData(dir, managerId, month);
  const listCodes = [
    ...data.activeShifts.map((s) => s.shiftCode),
    "WO",
    "HO",
  ].filter(Boolean);

  const rosterSheet = buildRosterSheet(data, dir);
  const listsSheet = buildListsSheet(listCodes);

  const dataStartRow = 5;
  const firstDayCol = 7;
  const lastDataRow = dataStartRow + data.rows.length - 1;
  const lastDayCol = firstDayCol + data.dayHeaders.length - 1;
  const listEndRow = 1 + listCodes.length;

  const rosterOptions: Sheet<Blob> & DataValidationSheetOptions = {
    sheet: "Roster",
    data: rosterSheet,
    stickyRowsCount: 4,
    stickyColumnsCount: 6,
    dataValidation: [
      {
        cellRange: {
          from: { row: dataStartRow, column: firstDayCol },
          to: { row: lastDataRow, column: lastDayCol },
        },
        validation: {
          type: "list",
          valuesRange: `Lists!$A$2:$A$${listEndRow}`,
          input: "Select shift code, WO, or HO",
          inputTitle: "Day assignment",
          error: "Choose a value from the list or leave blank",
          allowBlank: true,
        },
      },
    ],
  };

  const sheets: Sheet<Blob>[] = [
    rosterOptions,
    { sheet: "Lists", data: listsSheet },
  ];

  const blob = await writeExcelFile(sheets, { features: [dataValidation] }).toBlob();

  const filename = `roster_${data.manager.code || "MGR"}_${month}.xlsx`;
  downloadBlob(filename, blob);
  return { filename, teamCount: data.teamCount };
}
