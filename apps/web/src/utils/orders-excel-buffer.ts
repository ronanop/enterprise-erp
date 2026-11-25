import writeXlsxFile from "write-excel-file/browser";

import {
  ORDER_EXPORT_COLUMN_WIDTHS,
  ORDER_EXPORT_HEADERS,
  normalizeOrderExportRow,
  type OrderExportRow,
} from "@/utils/order-export-shared";

type ExcelCell = {
  type: typeof String | typeof Number;
  value: string | number | null;
  fontWeight?: "bold";
};

function toExcelCell(value: string | number | null | undefined): ExcelCell {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { type: Number, value };
  }
  const text = value == null ? "" : String(value);
  return { type: String, value: text };
}

/**
 * Purchase order Excel export uses write-excel-file (same stack as finance / GRN exports).
 */
export async function buildOrdersExcelBuffer(rows: OrderExportRow[]): Promise<ArrayBuffer> {
  const emptyRow = Object.fromEntries(
    ORDER_EXPORT_HEADERS.map((h) => [h, ""]),
  ) as OrderExportRow;
  const data =
    rows.length > 0 ? rows.map((row) => normalizeOrderExportRow(row)) : [emptyRow];

  const headerRow: ExcelCell[] = ORDER_EXPORT_HEADERS.map((h) => ({
    type: String,
    value: h,
    fontWeight: "bold",
  }));
  const body: ExcelCell[][] = data.map((row) =>
    ORDER_EXPORT_HEADERS.map((key) => toExcelCell(row[key] ?? "")),
  );

  const result = await writeXlsxFile([
    {
      sheet: "Purchase Orders",
      stickyRowsCount: 1,
      data: [headerRow, ...body],
      columns: ORDER_EXPORT_COLUMN_WIDTHS.map((width) => ({ width })),
    },
  ]);
  const blob = await result.toBlob();
  return blob.arrayBuffer();
}
