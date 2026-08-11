import * as XLSX from "xlsx";

import {
  ORDER_EXPORT_COLUMN_WIDTHS,
  ORDER_EXPORT_HEADERS,
  normalizeOrderExportRow,
  type OrderExportRow,
} from "@/utils/order-export-shared";

/**
 * Purchase order Excel export uses SheetJS (same as GRN export).
 * ExcelJS column metadata was intermittently clearing header text from column K onward.
 */
export async function buildOrdersExcelBuffer(rows: OrderExportRow[]): Promise<ArrayBuffer> {
  const emptyRow = Object.fromEntries(
    ORDER_EXPORT_HEADERS.map((h) => [h, ""]),
  ) as OrderExportRow;
  const data =
    rows.length > 0 ? rows.map((row) => normalizeOrderExportRow(row)) : [emptyRow];

  const aoa: (string | number)[][] = [
    [...ORDER_EXPORT_HEADERS],
    ...data.map((row) => ORDER_EXPORT_HEADERS.map((key) => row[key] ?? "")),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  ws["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
  ws["!views"] = [
    {
      state: "frozen",
      ySplit: 1,
      topLeftCell: "A2",
      activeCell: "A2",
    },
  ];
  ws["!cols"] = ORDER_EXPORT_COLUMN_WIDTHS.map((wch) => ({ wch }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Purchase Orders");

  const written = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as
    | Uint8Array
    | number[];
  const bytes =
    written instanceof Uint8Array ? written : new Uint8Array(written);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
