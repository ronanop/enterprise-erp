/**
 * Excel import service — parse & validate only. Never writes to the database.
 */

import * as XLSX from "xlsx";

import {
  extractEmployeeCode,
  normalizeLookupKey,
  suggestColumnMapping,
} from "@/components/assets/excel-import/excel-import-mapper";
import {
  validateImportRows,
  validateImportTemplate,
} from "@/components/assets/excel-import/excel-import-validator";
import {
  ACCEPTED_IMPORT_EXTENSIONS,
  ExcelImportError,
  type ExcelImportAcceptedExtension,
  type ExcelImportColumnMapping,
  type ExcelImportMasterLookups,
  type ExcelImportParseResult,
  type ExcelImportRawSheet,
  type ExcelImportTemplateResult,
  type ExcelImportValidationSummary,
} from "@/components/assets/excel-import/excel-import.types";

export function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx).toLowerCase();
}

export function assertAcceptedImportFile(fileName: string): ExcelImportAcceptedExtension {
  const ext = getFileExtension(fileName);
  if (!(ACCEPTED_IMPORT_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new ExcelImportError(
      "unsupported_format",
      `Unsupported file type "${ext || "(none)"}". Accepted: ${ACCEPTED_IMPORT_EXTENSIONS.join(", ")}`,
    );
  }
  return ext as ExcelImportAcceptedExtension;
}

function sheetFromWorkbook(wb: XLSX.WorkBook): ExcelImportRawSheet {
  if (!wb.SheetNames.length) {
    throw new ExcelImportError("empty_workbook", "Workbook has no sheets");
  }
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!matrix.length) {
    throw new ExcelImportError("empty_workbook", "Sheet is empty");
  }

  const headerRow = matrix[0] ?? [];
  const headers = headerRow.map((h, i) => {
    const label = String(h ?? "").trim();
    return label || `Column ${i + 1}`;
  });

  const rows: ExcelImportRawSheet["rows"] = [];
  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    const cells: Record<string, string> = {};
    let any = false;
    for (let c = 0; c < headers.length; c++) {
      const val = String(line[c] ?? "").trim();
      cells[headers[c]] = val;
      if (val) any = true;
    }
    if (!any) continue;
    rows.push({ rowNumber: i + 1, cells });
  }

  return { sheetName, headers, rows };
}

function readWorkbookFromBinary(data: Uint8Array | number[] | ArrayBuffer): XLSX.WorkBook {
  if (data instanceof ArrayBuffer) {
    return XLSX.read(new Uint8Array(data), { type: "array", cellDates: true });
  }
  return XLSX.read(data, { type: "array", cellDates: true });
}

export async function parseImportWorkbook(
  file: Pick<File, "name"> & { arrayBuffer: () => Promise<ArrayBuffer> },
): Promise<ExcelImportParseResult> {
  const extension = assertAcceptedImportFile(file.name);
  try {
    const buffer = await file.arrayBuffer();
    const wb = readWorkbookFromBinary(buffer);
    const sheet = sheetFromWorkbook(wb);
    return { fileName: file.name, extension, sheet };
  } catch (err) {
    if (err instanceof ExcelImportError) throw err;
    throw new ExcelImportError(
      "parse_error",
      err instanceof Error ? err.message : "Failed to parse workbook",
    );
  }
}

/** Test / advanced entry: parse already-loaded workbook bytes. */
export function parseImportBinary(
  fileName: string,
  data: Uint8Array | number[] | ArrayBuffer,
): ExcelImportParseResult {
  const extension = assertAcceptedImportFile(fileName);
  try {
    const wb = readWorkbookFromBinary(data);
    const sheet = sheetFromWorkbook(wb);
    return { fileName, extension, sheet };
  } catch (err) {
    if (err instanceof ExcelImportError) throw err;
    throw new ExcelImportError(
      "parse_error",
      err instanceof Error ? err.message : "Failed to parse workbook",
    );
  }
}

export function parseImportCsvText(fileName: string, text: string): ExcelImportParseResult {
  const extension = assertAcceptedImportFile(fileName);
  try {
    const wb = XLSX.read(text, { type: "string" });
    const sheet = sheetFromWorkbook(wb);
    return { fileName, extension, sheet };
  } catch (err) {
    if (err instanceof ExcelImportError) throw err;
    throw new ExcelImportError(
      "parse_error",
      err instanceof Error ? err.message : "Failed to parse CSV",
    );
  }
}

export function runTemplateValidation(
  sheet: ExcelImportRawSheet,
  mapping?: ExcelImportColumnMapping,
): ExcelImportTemplateResult {
  return validateImportTemplate(sheet, mapping);
}

export function runRowValidation(
  sheet: ExcelImportRawSheet,
  mapping: ExcelImportColumnMapping,
  lookups: ExcelImportMasterLookups,
): ExcelImportValidationSummary {
  return validateImportRows(sheet, mapping, lookups);
}

export function buildMasterLookups(input: {
  branches: Array<{ id: string; label: string }>;
  departments: Array<{ id: string; label: string }>;
  types: Array<{ id: string; label: string }>;
  employees: Array<{ id: string; label: string }>;
}): ExcelImportMasterLookups {
  const branchesByLabel = new Map<string, string>();
  for (const b of input.branches) {
    branchesByLabel.set(normalizeLookupKey(b.label), b.id);
    branchesByLabel.set(normalizeLookupKey(b.id), b.id);
  }
  const departmentsByLabel = new Map<string, string>();
  for (const d of input.departments) {
    departmentsByLabel.set(normalizeLookupKey(d.label), d.id);
    departmentsByLabel.set(normalizeLookupKey(d.id), d.id);
  }
  const typesByLabel = new Map<string, string>();
  for (const t of input.types) {
    typesByLabel.set(normalizeLookupKey(t.label), t.id);
    typesByLabel.set(normalizeLookupKey(t.id), t.id);
  }
  const employeesByKey = new Map<string, string>();
  for (const e of input.employees) {
    employeesByKey.set(normalizeLookupKey(e.id), e.id);
    employeesByKey.set(normalizeLookupKey(e.label), e.id);
    const code = extractEmployeeCode(e.label);
    if (code) employeesByKey.set(normalizeLookupKey(code), e.id);
  }
  return { branchesByLabel, departmentsByLabel, typesByLabel, employeesByKey };
}

export const excelImportService = {
  assertAcceptedImportFile,
  parseImportWorkbook,
  parseImportCsvText,
  parseImportBinary,
  suggestColumnMapping,
  runTemplateValidation,
  runRowValidation,
  buildMasterLookups,
};
