import writeExcelFile, {
  type Cell,
  type Feature,
  type Sheet,
} from "write-excel-file/browser";
import dataValidation, {
  type DataValidationSheetOptions,
} from "@onparallel/write-excel-file-data-validation";

import { downloadBlob } from "@/lib/spreadsheet";
import {
  buildManagerRosterExportData,
  type ManagerRosterExportData,
  type ShiftRosterDirectory,
} from "@/services/shift-roster-service";
import type { ShiftRecord } from "@/types/shift-roster-management";

type DayCfRule = NonNullable<Sheet<Blob>["conditionalFormatting"]>[number];

const TEAL = "#0f766e";
const TEAL_LIGHT = "#ccfbf1";
const SLATE_50 = "#f8fafc";
const SLATE_200 = "#e2e8f0";
const AMBER_100 = "#fef3c7";
const INK = "#0f172a";
const MUTED = "#64748b";
const HO_TEXT = "#92400e";

/** Ensure write-excel-file gets a #RRGGBB color (invalid colors corrupt the xlsx). */
function safeHexColor(raw: string | undefined, fallback: string): string {
  const v = (raw || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  return fallback;
}

function textCell(value: string, style?: Record<string, unknown>): Cell {
  return { value, type: String, ...style };
}

/** Base day-cell style only — colors come from conditional formatting so edits update live. */
function dayCellBaseStyle(): Record<string, unknown> {
  return {
    align: "center" as const,
    fontWeight: "bold" as const,
    backgroundColor: "#ffffff",
    textColor: INK,
  };
}

function buildDayConditionalFormatting(
  data: ManagerRosterExportData,
  dir: ShiftRosterDirectory,
  range: { from: { row: number; column: number }; to: { row: number; column: number } },
): DayCfRule[] {
  const rules: DayCfRule[] = [
    {
      cellRange: range,
      condition: { operator: "=", value: "WO" },
      style: { backgroundColor: SLATE_200, textColor: MUTED, fontWeight: "bold" },
    },
    {
      cellRange: range,
      condition: { operator: "=", value: "HO" },
      style: { backgroundColor: AMBER_100, textColor: HO_TEXT, fontWeight: "bold" },
    },
  ];

  const seen = new Set<string>();
  for (const s of data.activeShifts) {
    const code = (s.shiftCode || "").trim();
    if (!code) continue;
    const key = code.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const fromDir = dir.shifts.find((x) => x.shiftCode.toUpperCase() === key);
    const bg = safeHexColor(fromDir?.extension?.color ?? s.extension?.color, TEAL_LIGHT);
    rules.push({
      cellRange: range,
      condition: { operator: "=", value: code },
      style: { backgroundColor: bg, textColor: INK, fontWeight: "bold" },
    });
  }

  return rules;
}

/**
 * write-excel-file emits one `<conditionalFormatting>` per rule. When dataValidation
 * then inserts after the *first* CF sibling, later CF blocks end up after
 * `<dataValidations/>` and Excel reports "We found a problem with some content".
 * Merge same-sqref rules into a single element before dataValidation runs.
 */
function mergeSameSqrefConditionalFormatting(xml: string): string {
  const re = /<conditionalFormatting\s+sqref="([^"]+)">([\s\S]*?)<\/conditionalFormatting>/g;
  const bySqref = new Map<string, string[]>();
  const spans: { start: number; end: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    spans.push({ start: match.index, end: match.index + match[0].length });
    const sqref = match[1];
    const inner = match[2];
    const rules = [...inner.matchAll(/<cfRule\b[\s\S]*?<\/cfRule>/g)].map((r) => r[0]);
    const list = bySqref.get(sqref) ?? [];
    list.push(...rules);
    bySqref.set(sqref, list);
  }

  if (spans.length <= 1) return xml;

  let priority = 1;
  const merged = [...bySqref.entries()]
    .map(([sqref, rules]) => {
      const renumbered = rules.map((rule) =>
        rule.replace(/\spriority="\d+"/, ` priority="${priority++}"`),
      );
      return `<conditionalFormatting sqref="${sqref}">${renumbered.join("")}</conditionalFormatting>`;
    })
    .join("");

  // Remove from the end so earlier indexes stay valid.
  let next = xml;
  for (let i = spans.length - 1; i >= 0; i--) {
    const { start, end } = spans[i]!;
    next = next.slice(0, start) + (i === 0 ? merged : "") + next.slice(end);
  }
  return next;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Feature FileContent is irrelevant for XML-only transform
const mergeConditionalFormattingBySqref: Feature<any> = {
  files: {
    transform: {
      "xl/worksheets/sheet{id}.xml": {
        transform: (xml) => mergeSameSqrefConditionalFormatting(xml),
      },
    },
  },
};

function buildRosterSheet(
  data: ManagerRosterExportData,
  _dir: ShiftRosterDirectory,
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
  const dayStyle = dayCellBaseStyle();

  const shiftLegend = data.activeShifts.length
    ? data.activeShifts.map((s) => `${s.shiftCode}=${s.shiftName}`).join(" · ")
    : "(configure shifts in Shift master)";

  const rows: Cell[][] = [
    [
      textCell(
        `Roster month ${data.month} · ${data.manager.code} — pick shift code (A/B/C/D…) from dropdown`,
        metaStyle,
      ),
    ],
    [textCell("WO = weekly off · HO = holiday · blank = clear override", metaStyle)],
    [textCell(`Shifts: ${shiftLegend}`, metaStyle)],
    [
      textCell("employee_code", headerStyle),
      textCell("employee_name", headerStyle),
      ...data.dayHeaders.map((h) => textCell(h, headerStyle)),
    ],
  ];

  for (const emp of data.rows) {
    rows.push([
      textCell(emp.code, lockStyle),
      textCell(emp.name, lockStyle),
      ...emp.dayValues.map((v) => textCell(v, dayStyle)),
    ]);
  }

  return rows;
}

function buildListsSheet(shifts: ShiftRecord[]): Cell[][] {
  const header = {
    fontWeight: "bold" as const,
    backgroundColor: TEAL,
    textColor: "#ffffff",
  };
  const rows: Cell[][] = [
    [
      textCell("shift_code", header),
      textCell("shift_name", header),
      textCell("color", header),
    ],
    ...shifts.map((s) => {
      const color = safeHexColor(s.extension?.color, TEAL_LIGHT);
      return [
        textCell(s.shiftCode, { align: "center", fontWeight: "bold" }),
        textCell(s.shiftName),
        textCell(color, {
          align: "center",
          backgroundColor: color,
        }),
      ];
    }),
    [
      textCell("WO", { align: "center", fontWeight: "bold" }),
      textCell("Weekly off"),
      textCell(SLATE_200, { backgroundColor: SLATE_200 }),
    ],
    [
      textCell("HO", { align: "center", fontWeight: "bold" }),
      textCell("Holiday"),
      textCell(AMBER_100, { backgroundColor: AMBER_100 }),
    ],
  ];
  return rows;
}

export async function downloadManagerRosterXlsx(
  dir: ShiftRosterDirectory,
  managerId: string,
  month: string,
): Promise<{ teamCount: number; filename: string }> {
  const data = buildManagerRosterExportData(dir, managerId, month);
  const activeShifts = [...data.activeShifts].sort((a, b) =>
    a.shiftCode.localeCompare(b.shiftCode),
  );
  const listCodes = [...activeShifts.map((s) => s.shiftCode), "WO", "HO"].filter(Boolean);

  const rosterSheet = buildRosterSheet(data, dir);
  const listsSheet = buildListsSheet(activeShifts);

  const dataStartRow = 5;
  const firstDayCol = 3;
  const lastDataRow = dataStartRow + data.rows.length - 1;
  const lastDayCol = firstDayCol + data.dayHeaders.length - 1;
  const dayRange =
    data.rows.length > 0 && data.dayHeaders.length > 0
      ? {
          from: { row: dataStartRow, column: firstDayCol },
          to: { row: lastDataRow, column: lastDayCol },
        }
      : null;

  const rosterOptions: Sheet<Blob> & DataValidationSheetOptions = {
    sheet: "Roster",
    data: rosterSheet,
    stickyRowsCount: 4,
    stickyColumnsCount: 2,
    conditionalFormatting: dayRange ? buildDayConditionalFormatting(data, dir, dayRange) : undefined,
    dataValidation:
      dayRange
        ? [
            {
              cellRange: dayRange,
              validation: {
                type: "list",
                // Inline list avoids fragile cross-sheet refs; keep under Excel's 255-char limit.
                values: listCodes,
                input: "Select shift code, WO, or HO",
                inputTitle: "Day assignment",
                error: "Choose a value from the list or leave blank",
                allowBlank: true,
              },
            },
          ]
        : undefined,
  };

  const sheets: Sheet<Blob>[] = [
    rosterOptions,
    { sheet: "Lists", data: listsSheet },
  ];

  // Merge CF before dataValidation so dropdown insert does not split CF siblings.
  const blob = await writeExcelFile(sheets, {
    features: [mergeConditionalFormattingBySqref, dataValidation],
  }).toBlob();

  const filename = `roster_${data.manager.code || "MGR"}_${month}.xlsx`;
  downloadBlob(filename, blob);
  return { filename, teamCount: data.teamCount };
}
