import { parseSpreadsheetFile, parseSpreadsheetMatrix } from "@/lib/spreadsheet";

import {
  RECEIPT_SERIAL_NA,
  resizeSerialSlots,
} from "@/utils/receipt-serial-numbers";

const TEMPLATE_HEADERS = ["Line ID", "S No.", "Product", "Unit #", "Serial Number"] as const;

export type ReceiptSerialImportLine = {
  lineId: string;
  receiveQty: number;
  productLabel: string;
};

export type ReceiptSerialImportResult =
  | { ok: true; serialDraft: Record<string, string[]>; warning?: string }
  | { ok: false; message: string };

function isSafeRecordKey(key: string): boolean {
  return key !== "__proto__" && key !== "constructor" && key !== "prototype";
}

function normalizeSerialValue(raw: string): string {
  const v = raw.trim();
  return v.toUpperCase() === RECEIPT_SERIAL_NA ? RECEIPT_SERIAL_NA : v;
}

function cellValue(row: Record<string, unknown>, header: string): string {
  const v = row[header];
  if (v == null) return "";
  return String(v).trim();
}

function normalizeProductKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Match Excel "mouse" to PO line "dell mouse", etc. */
export function receiptProductsMatch(lineProduct: string, rowProduct: string): boolean {
  const a = normalizeProductKey(lineProduct);
  const b = normalizeProductKey(rowProduct);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  for (const t of bTokens) {
    if (t.length >= 3 && aTokens.has(t)) return true;
  }
  return false;
}

type ProductSerialRow = { product: string; serial: string };

function parseTemplateFormat(json: Record<string, unknown>[]): Map<string, Map<number, string>> {
  const byLine = new Map<string, Map<number, string>>();
  for (const row of json) {
    const lineId = cellValue(row, TEMPLATE_HEADERS[0]);
    if (!lineId || !isSafeRecordKey(lineId)) continue;
    const unitIndex = Number(cellValue(row, TEMPLATE_HEADERS[3]));
    if (!Number.isFinite(unitIndex) || unitIndex < 1) continue;
    const serial = cellValue(row, TEMPLATE_HEADERS[4]);
    const idx = Math.floor(unitIndex);
    if (!byLine.has(lineId)) byLine.set(lineId, new Map());
    byLine.get(lineId)!.set(idx, serial);
  }
  return byLine;
}

function rowLooksLikeTemplateHeader(row: unknown[]): boolean {
  const text = row.map((c) => String(c ?? "").toLowerCase()).join(" ");
  return text.includes("line id");
}

function rowLooksLikeProductSerialHeader(row: unknown[]): boolean {
  const text = row.map((c) => String(c ?? "").toLowerCase()).join(" ");
  return text.includes("product") && text.includes("serial");
}

function parseKeyedProductSerialRows(json: Record<string, unknown>[]): ProductSerialRow[] {
  const rows: ProductSerialRow[] = [];
  for (const row of json) {
    const keys = Object.keys(row);
    const productKey = keys.find((k) => /^product/i.test(k.trim()));
    const serialKey = keys.find((k) => /serial/i.test(k.trim()));
    if (!productKey || !serialKey) continue;
    const product = cellValue(row, productKey);
    const serial = cellValue(row, serialKey);
    if (!product && !serial) continue;
    rows.push({ product, serial });
  }
  return rows;
}

function parseMatrixProductSerialRows(matrix: unknown[][]): ProductSerialRow[] {
  const rows: ProductSerialRow[] = [];
  let start = 0;
  if (matrix.length > 0 && rowLooksLikeTemplateHeader(matrix[0] ?? [])) {
    return rows;
  }
  if (matrix.length > 0 && rowLooksLikeProductSerialHeader(matrix[0] ?? [])) {
    start = 1;
  }
  for (let r = start; r < matrix.length; r += 1) {
    const row = matrix[r] ?? [];
    const product = String(row[0] ?? "").trim();
    const serial = String(row[1] ?? "").trim();
    if (!product && !serial) continue;
    rows.push({ product, serial });
  }
  return rows;
}

function buildSerialDraftFromTemplate(
  byLine: Map<string, Map<number, string>>,
  expected: ReceiptSerialImportLine[],
): Record<string, string[]> {
  const serialDraft: Record<string, string[]> = {};
  for (const line of expected) {
    const qty = Math.max(0, Math.floor(line.receiveQty));
    if (qty <= 0 || !isSafeRecordKey(line.lineId)) continue;
    const imported = byLine.get(line.lineId);
    const slots: string[] = [];
    for (let i = 1; i <= qty; i += 1) {
      const raw = imported?.get(i) ?? "";
      slots.push(normalizeSerialValue(raw));
    }
    serialDraft[line.lineId] = slots;
  }
  return serialDraft;
}

function buildSerialDraftFromProductRows(
  importRows: ProductSerialRow[],
  expected: ReceiptSerialImportLine[],
): { serialDraft: Record<string, string[]>; matched: number } {
  const serialDraft: Record<string, string[]> = {};
  const cursors = expected.map((line) => ({
    lineId: line.lineId,
    productLabel: line.productLabel,
    qty: Math.max(0, Math.floor(line.receiveQty)),
    filled: 0,
  }));

  for (const line of expected) {
    const qty = Math.max(0, Math.floor(line.receiveQty));
    if (qty > 0 && isSafeRecordKey(line.lineId)) {
      serialDraft[line.lineId] = resizeSerialSlots([], qty);
    }
  }

  let matched = 0;
  for (const row of importRows) {
    const serial = normalizeSerialValue(row.serial);
    if (!serial) continue;

    const target = cursors.find(
      (c) => c.filled < c.qty && receiptProductsMatch(c.productLabel, row.product),
    );
    if (!target || !isSafeRecordKey(target.lineId)) continue;

    const slots = Object.prototype.hasOwnProperty.call(serialDraft, target.lineId)
      ? serialDraft[target.lineId]
      : undefined;
    if (!slots) continue;
    slots[target.filled] = serial;
    target.filled += 1;
    matched += 1;
  }

  return { serialDraft, matched };
}

function countFilledSerials(serialDraft: Record<string, string[]>): number {
  let n = 0;
  for (const slots of Object.values(serialDraft)) {
    for (const s of slots) {
      if (s.trim()) n += 1;
    }
  }
  return n;
}

/** Apply Excel rows onto existing draft; supports template or Product + Serial columns. */
export async function importReceiptSerialsFromExcel(
  file: File,
  expected: ReceiptSerialImportLine[],
): Promise<ReceiptSerialImportResult> {
  try {
    const activeExpected = expected.filter((l) => Math.floor(l.receiveQty) > 0);
    if (activeExpected.length === 0) {
      return {
        ok: false,
        message: "No receive quantities on this PO. Enter Receive now values before importing.",
      };
    }

    const json = await parseSpreadsheetFile(file);
    const byLine = parseTemplateFormat(json);
    let serialDraft: Record<string, string[]>;
    let warning: string | undefined;

    if (byLine.size > 0) {
      serialDraft = buildSerialDraftFromTemplate(byLine, activeExpected);
    } else {
      let productRows = parseKeyedProductSerialRows(json);
      if (productRows.length === 0) {
        const matrix = await parseSpreadsheetMatrix(file);
        productRows = parseMatrixProductSerialRows(matrix);
      }
      if (productRows.length === 0) {
        return {
          ok: false,
          message:
            "No serial rows found. Use two columns: Product | Serial Number (e.g. mouse, 5gt56), or export from this dialog first.",
        };
      }
      const result = buildSerialDraftFromProductRows(productRows, activeExpected);
      serialDraft = result.serialDraft;
      const filled = countFilledSerials(serialDraft);
      if (filled === 0) {
        return {
          ok: false,
          message:
            "Serials did not match any receiving lines. Check product names (e.g. mouse → dell mouse).",
        };
      }
      if (result.matched < productRows.filter((r) => normalizeSerialValue(r.serial)).length) {
        warning = "Some Excel rows could not be matched to a product line.";
      }
    }

    const filled = countFilledSerials(serialDraft);
    if (filled === 0) {
      return {
        ok: false,
        message: "No serial numbers were imported. Check the file format and product names.",
      };
    }

    return { ok: true, serialDraft, warning };
  } catch {
    return { ok: false, message: "Could not parse the Excel file." };
  }
}

/** Import all serial slots for one receiving line from Excel or a multi-line text file. */
export function importLineSerialsFromFile(
  file: File,
  line: ReceiptSerialImportLine,
): Promise<ReceiptSerialImportResult> {
  const qty = Math.max(0, Math.floor(line.receiveQty));
  if (qty <= 0) {
    return Promise.resolve({
      ok: false,
      message: "No units to receive for this line.",
    });
  }

  const name = file.name.toLowerCase();
  const isText =
    file.type === "text/plain" ||
    file.type === "text/csv" ||
    name.endsWith(".txt") ||
    name.endsWith(".csv");

  if (isText) {
    return file.text().then((text) => {
      const serials = text
        .split(/\r?\n/)
        .map((row) => normalizeSerialValue(row))
        .filter((s) => s.length > 0)
        .slice(0, qty);
      if (serials.length === 0) {
        return {
          ok: false,
          message: "No serial numbers found. Put one serial per line in the text file.",
        };
      }
      const slots = resizeSerialSlots([], qty);
      for (let i = 0; i < serials.length; i += 1) {
        slots[i] = serials[i];
      }
      const warning =
        serials.length < qty
          ? `Imported ${serials.length} of ${qty} serials. Enter the rest manually or add more lines to the file.`
          : undefined;
      return {
        ok: true,
        serialDraft: { [line.lineId]: slots },
        warning,
      };
    });
  }

  return importReceiptSerialsFromExcel(file, [line]);
}

export const RECEIPT_SERIAL_FILE_ACCEPT =
  ".xlsx,.xls,.txt,.csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type SingleSerialImportContext = {
  lineId?: string;
  unitIndex?: number;
};

export type SingleSerialImportResult =
  | { ok: true; serial: string }
  | { ok: false; message: string };

function firstNonEmptySerialFromText(text: string): string {
  for (const line of text.split(/\r?\n/)) {
    const serial = normalizeSerialValue(line);
    if (serial) return serial;
  }
  const whole = normalizeSerialValue(text);
  return whole;
}

async function parseOneSerialFromWorkbook(
  file: File,
  context?: SingleSerialImportContext,
): Promise<SingleSerialImportResult> {
  const json = await parseSpreadsheetFile(file);
  const matrix = await parseSpreadsheetMatrix(file);

  const lineId = context?.lineId?.trim();
  const unitIndex = context?.unitIndex;

  if (lineId && isSafeRecordKey(lineId) && unitIndex != null && unitIndex >= 1) {
    const byLine = parseTemplateFormat(json);
    const unitMap = byLine.get(lineId);
    const fromTemplate = unitMap?.get(Math.floor(unitIndex));
    if (fromTemplate?.trim()) {
      return { ok: true, serial: normalizeSerialValue(fromTemplate) };
    }
  }

  const productRows = parseKeyedProductSerialRows(json);
  if (productRows.length > 0) {
    const serial = normalizeSerialValue(productRows[0].serial);
    if (serial) return { ok: true, serial };
  }

  const matrixRows = parseMatrixProductSerialRows(matrix);
  if (matrixRows.length > 0) {
    const serial = normalizeSerialValue(matrixRows[0].serial);
    if (serial) return { ok: true, serial };
  }

  for (const row of matrix) {
    for (const cell of row ?? []) {
      const serial = normalizeSerialValue(String(cell ?? ""));
      if (serial) return { ok: true, serial };
    }
  }

  return {
    ok: false,
    message: "No serial number found in file. Use one serial per file (text line or Excel cell).",
  };
}

/** Read one serial from a small file (text line or first serial cell in Excel). */
export function importOneSerialFromFile(
  file: File,
  context?: SingleSerialImportContext,
): Promise<SingleSerialImportResult> {
  const name = file.name.toLowerCase();
  const isText =
    file.type === "text/plain" ||
    file.type === "text/csv" ||
    name.endsWith(".txt") ||
    name.endsWith(".csv");

  if (isText) {
    return file.text().then((text) => {
      const serial = firstNonEmptySerialFromText(text);
      if (!serial) {
        return { ok: false, message: "No serial number found in the text file." };
      }
      return { ok: true, serial };
    });
  }

  return parseOneSerialFromWorkbook(file, context).catch(() => ({
    ok: false,
    message: "Could not parse the file.",
  }));
}
