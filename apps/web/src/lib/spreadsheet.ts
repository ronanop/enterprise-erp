import { readSheet } from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";

export type SpreadsheetRow = Record<string, string | number | boolean | null | undefined>;

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function neutralizeCsvFormula(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const str = neutralizeCsvFormula(String(value));
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function rowsToCsv(rows: SpreadsheetRow[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(",")),
  ];
  return lines.join("\r\n");
}

export function downloadCsv(filename: string, rows: SpreadsheetRow[]) {
  const csv = rowsToCsv(rows);
  downloadBlob(
    filename,
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
  );
}

/** Decode CSV uploads without silently converting legacy Windows text to mojibake. */
export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Excel on legacy Windows commonly writes CSV as Windows-1252.
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function rowsToSheetCells(rows: SpreadsheetRow[]) {
  if (rows.length === 0) return [[""]];
  const headers = Object.keys(rows[0]);
  return [
    headers,
    ...rows.map((row) =>
      headers.map((h) => {
        const v = row[h];
        if (v == null) return null;
        if (typeof v === "boolean" || typeof v === "number") return v;
        return String(v);
      }),
    ),
  ];
}

export async function downloadXlsx(
  filename: string,
  sheets: { name: string; rows: SpreadsheetRow[] }[],
) {
  const result = await writeXlsxFile(
    sheets.map((s) => ({
      sheet: s.name.slice(0, 31),
      data: rowsToSheetCells(s.rows),
    })),
  );
  const blob = await result.toBlob();
  downloadBlob(filename, blob);
}

function parseCsvText(text: string): Record<string, unknown>[] {
  const normalized = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      current.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" || (ch === "\r" && next === "\n")) {
      current.push(cell);
      cell = "";
      if (current.some((c) => c !== "")) rows.push(current);
      current = [];
      if (ch === "\r") i++;
      continue;
    }
    if (ch === "\r") {
      current.push(cell);
      cell = "";
      if (current.some((c) => c !== "")) rows.push(current);
      current = [];
      continue;
    }
    cell += ch;
  }
  current.push(cell);
  if (current.some((c) => c !== "")) rows.push(current);

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const out: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      if (!header) return;
      out[header] = cols[idx] ?? "";
    });
    return out;
  });
}

function matrixToObjects(matrix: unknown[][]): Record<string, unknown>[] {
  if (matrix.length === 0) return [];
  const headers = matrix[0].map((h) => String(h ?? "").trim());
  return matrix.slice(1).flatMap((cols) => {
    const out: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, idx) => {
      if (!header) return;
      const value = cols[idx] ?? "";
      if (value != null && value !== "") hasValue = true;
      out[header] = value;
    });
    return hasValue ? [out] : [];
  });
}

/** Parse CSV or XLSX (first sheet) into row objects keyed by header. */
export async function parseSpreadsheetFile(
  file: File,
): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv") || file.type === "text/csv") {
    const buffer = await file.arrayBuffer();
    const text = decodeCsvBuffer(buffer);
    return parseCsvText(text);
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
    const matrix = await readSheet(file);
    return matrixToObjects(matrix);
  }

  throw new Error("Unsupported file type. Please upload a .csv or .xlsx file.");
}

export async function parseSpreadsheetMatrix(file: File): Promise<unknown[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const buffer = await file.arrayBuffer();
    const text = decodeCsvBuffer(buffer);
    const objects = parseCsvText(text);
    if (objects.length === 0) return [];
    const headers = Object.keys(objects[0]);
    return [headers, ...objects.map((row) => headers.map((h) => row[h] ?? ""))];
  }
  return readSheet(file);
}
