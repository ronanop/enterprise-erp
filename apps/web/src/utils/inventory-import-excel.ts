import { parseSpreadsheetFile, parseSpreadsheetMatrix } from "@/lib/spreadsheet";

export type InventoryExcelRow = {
  product: string;
  serial: string;
};

export type InventoryExcelParseResult =
  | { ok: true; rows: InventoryExcelRow[] }
  | { ok: false; message: string };

function rowLooksLikeProductSerialHeader(row: unknown[]): boolean {
  const text = row.map((c) => String(c ?? "").toLowerCase()).join(" ");
  return text.includes("product") && text.includes("serial");
}

function parseMatrix(matrix: unknown[][]): InventoryExcelRow[] {
  const rows: InventoryExcelRow[] = [];
  let start = 0;
  if (matrix.length > 0 && rowLooksLikeProductSerialHeader(matrix[0] ?? [])) {
    start = 1;
  }
  for (let r = start; r < matrix.length; r += 1) {
    const row = matrix[r] ?? [];
    const product = String(row[0] ?? "").trim();
    const serial = String(row[1] ?? "").trim();
    if (!product && !serial) continue;
    if (!product || !serial) continue;
    rows.push({ product, serial });
  }
  return rows;
}

function parseKeyed(json: Record<string, unknown>[]): InventoryExcelRow[] {
  const rows: InventoryExcelRow[] = [];
  for (const row of json) {
    const keys = Object.keys(row);
    const productKey = keys.find((k) => /^product/i.test(k.trim()));
    const serialKey = keys.find((k) => /serial/i.test(k.trim()));
    if (!productKey || !serialKey) continue;
    const product = String(row[productKey] ?? "").trim();
    const serial = String(row[serialKey] ?? "").trim();
    if (!product || !serial) continue;
    rows.push({ product, serial });
  }
  return rows;
}

/** Product in column A, serial in column B (optional header row). */
export async function parseInventoryImportExcel(file: File): Promise<InventoryExcelParseResult> {
  try {
    const json = await parseSpreadsheetFile(file);
    let rows = parseKeyed(json);
    if (rows.length === 0) {
      const matrix = await parseSpreadsheetMatrix(file);
      rows = parseMatrix(matrix);
    }
    if (rows.length === 0) {
      return {
        ok: false,
        message: "No rows found. Use Product in column A and Serial in column B.",
      };
    }
    return { ok: true, rows };
  } catch {
    return { ok: false, message: "Could not parse the Excel file." };
  }
}
