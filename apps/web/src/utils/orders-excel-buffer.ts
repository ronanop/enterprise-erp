import ExcelJS from "exceljs";

import {
  ORDER_EXPORT_COLUMN_WIDTHS,
  ORDER_EXPORT_HEADERS,
  normalizeOrderExportRow,
  type OrderExportRow,
} from "@/utils/order-export-shared";

const HEADER_FILL_ARGB = "FFFFFF00";
const DESCRIPTION_HEADER = "Description";

/** Excel column width (approx. characters); min width so labels like "Total amount with tax" fit. */
function widthForText(text: string, cap: number): number {
  const trimmed = text.trim();
  if (!trimmed) return 11;
  const lines = trimmed.split(/\r?\n/);
  const longestLine = Math.max(...lines.map((line) => line.length), 0);
  return Math.min(cap, Math.max(11, longestLine + 2));
}

function columnCap(header: string): number {
  if (header === DESCRIPTION_HEADER) return 52;
  if (header.includes("amount") || header.includes("tax") || header.includes("Margin")) return 22;
  if (header.includes("date")) return 16;
  return 28;
}

function applyHeaderStyle(cell: ExcelJS.Cell) {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_FILL_ARGB },
  };
  cell.font = { bold: true, size: 11, color: { argb: "FF000000" } };
  cell.alignment = {
    vertical: "middle",
    horizontal: "left",
    wrapText: true,
    shrinkToFit: false,
  };
  cell.border = {
    top: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
  };
}

export async function buildOrdersExcelBuffer(rows: OrderExportRow[]): Promise<ArrayBuffer> {
  const emptyRow = Object.fromEntries(
    ORDER_EXPORT_HEADERS.map((h) => [h, ""]),
  ) as OrderExportRow;
  const data =
    rows.length > 0 ? rows.map((row) => normalizeOrderExportRow(row)) : [emptyRow];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Purchase Orders", {
    properties: { defaultRowHeight: 15 },
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  sheet.views = [
    {
      state: "frozen",
      ySplit: 1,
      topLeftCell: "A2",
      activeCell: "A2",
      showGridLines: true,
      zoomScale: 100,
    },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.height = 36;
  ORDER_EXPORT_HEADERS.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    applyHeaderStyle(cell);
  });
  headerRow.commit();

  for (const row of data) {
    const excelRow = sheet.addRow(ORDER_EXPORT_HEADERS.map((key) => row[key]));
    excelRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
    });
  }

  ORDER_EXPORT_HEADERS.forEach((header, index) => {
    const colIndex = index + 1;
    const minFromPreset = ORDER_EXPORT_COLUMN_WIDTHS[index] ?? 14;
    const cap = columnCap(header);
    let width = Math.max(minFromPreset, widthForText(header, cap));

    for (const row of data) {
      const value = row[header];
      width = Math.max(width, widthForText(String(value ?? ""), cap));
    }

    const column = sheet.getColumn(colIndex);
    column.width = width;
    column.hidden = false;
  });

  const lastRow = sheet.rowCount;
  const lastCol = ORDER_EXPORT_HEADERS.length;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: lastRow, column: lastCol },
  };

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
