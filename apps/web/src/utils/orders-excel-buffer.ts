import writeXlsxFile from "write-excel-file/browser";

import {
  ORDER_EXPORT_HEADERS,
  normalizeOrderExportRow,
  type OrderExportRow,
} from "@/utils/order-export-shared";

/**
 * Purchase order Excel export uses write-excel-file (same stack as finance exports).
 */
export async function buildOrdersExcelBuffer(rows: OrderExportRow[]): Promise<ArrayBuffer> {
  const emptyRow = Object.fromEntries(
    ORDER_EXPORT_HEADERS.map((h) => [h, ""]),
  ) as OrderExportRow;
  const data =
    rows.length > 0 ? rows.map((row) => normalizeOrderExportRow(row)) : [emptyRow];

  const aoa: (string | number | null)[][] = [
    [...ORDER_EXPORT_HEADERS],
    ...data.map((row) => ORDER_EXPORT_HEADERS.map((key) => row[key] ?? "")),
  ];

  const result = await writeXlsxFile([
    {
      sheet: "Purchase Orders",
      data: aoa,
    },
  ]);
  const blob = await result.toBlob();
  return blob.arrayBuffer();
}
