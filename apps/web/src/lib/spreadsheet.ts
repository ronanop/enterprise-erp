import { readSheet } from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";

export type SpreadsheetRow = Record<string, string | number | boolean | null | undefined>;

/** Cell value or styled cell for write-excel-file. */
export type SpreadsheetCellValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | {
      value: string | number | boolean | null;
      type?: typeof String | typeof Number | typeof Boolean | typeof Date | "Formula";
      backgroundColor?: string;
      textColor?: string;
      fontWeight?: "bold";
      align?: "left" | "center" | "right";
    };

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
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

function normalizeSheetCell(cell: SpreadsheetCellValue) {
  if (cell == null) return null;
  if (typeof cell === "object" && "value" in cell) {
    return {
      ...cell,
      value: cell.value == null ? null : cell.value,
    };
  }
  if (typeof cell === "boolean" || typeof cell === "number") return cell;
  return String(cell);
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

/** Download XLSX from a cell matrix (supports backgroundColor / textColor on cells). */
export async function downloadXlsxMatrix(
  filename: string,
  sheets: { name: string; data: SpreadsheetCellValue[][] }[],
) {
  const result = await writeXlsxFile(
    sheets.map((s) => ({
      sheet: s.name.slice(0, 31),
      data:
        s.data.length === 0
          ? [[""]]
          : s.data.map((row) => row.map((cell) => normalizeSheetCell(cell))),
    })),
  );
  const blob = await result.toBlob();
  downloadBlob(filename, blob);
}

function parseCsvToMatrix(text: string): string[][] {
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
  return rows.map((row) => row.map((c) => c.trim()));
}

function parseCsvText(text: string): Record<string, unknown>[] {
  return matrixToObjects(parseCsvToMatrix(text));
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return String(value).trim();
}

function matrixToStringRows(matrix: unknown[][]): string[][] {
  return matrix.map((row) => row.map((cell) => cellToString(cell)));
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

/** Drop title/legend rows until a row contains the required header cell. */
export function extractDataMatrix(
  matrix: string[][],
  requiredHeader: string,
): string[][] {
  const needle = requiredHeader.toLowerCase();
  const idx = matrix.findIndex((row) =>
    row.some((cell) => cell.toLowerCase() === needle),
  );
  return idx >= 0 ? matrix.slice(idx) : matrix;
}

export function matrixToCsv(matrix: string[][]): string {
  return matrix.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

/** Parse CSV or XLSX (first sheet) into a string matrix (including header row). */
export async function parseSpreadsheetMatrix(file: File): Promise<string[][]> {
  return parseSpreadsheetFileAsMatrix(file);
}

export async function parseSpreadsheetFileAsMatrix(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv") || file.type === "text/csv") {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buffer);
    return parseCsvToMatrix(text);
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
    const matrix = await readSheet(file);
    return matrixToStringRows(matrix);
  }

  throw new Error("Unsupported file type. Please upload a .csv or .xlsx file.");
}

/** Parse CSV or XLSX (first sheet) into row objects keyed by header. */
export async function parseSpreadsheetFile(
  file: File,
): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv") || file.type === "text/csv") {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buffer);
    return parseCsvText(text);
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
    const matrix = await readSheet(file);
    return matrixToObjects(matrixToStringRows(matrix));
  }

  throw new Error("Unsupported file type. Please upload a .csv or .xlsx file.");
}
