import { downloadXlsx } from "@/lib/spreadsheet";
import type { ScmVendorPo } from "@/services/procurement-service";

const HEADERS = [
  "S.No",
  "Company PO Number",
  "PO Date",
  "Vendor",
  "GRN Status",
  "GRN Number",
  "GRN Date",
  "Items",
] as const;

export type GrnExportRow = Record<(typeof HEADERS)[number], string | number>;

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function formatGrnStatusLabel(status: string): string {
  const value = (status || "").toLowerCase();
  if (value === "closed" || value === "delivered") return "Delivered";
  if (value === "partial") return "Partial";
  if (value === "pending") return "Open";
  return status
    ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
    : "";
}

export function resolveGrnNumber(row: ScmVendorPo): string {
  const companyPo = row.company_po_number?.trim() || row.document_number;
  return row.current_grn_number?.trim() || (companyPo ? `${companyPo}/001` : "");
}

/** One Excel row per PO / GRN; line items listed with item numbers inside the Items cell. */
function formatItemsCell(order: ScmVendorPo): string {
  const lines = order.lines || [];
  if (lines.length === 0) return "";

  return lines
    .map((line, index) => {
      const itemNo = index + 1;
      const name = (line.product_name || `Line ${line.line_number}`).trim();
      const ordered = Number(line.quantity) || 0;
      const received = Number(line.quantity_received) || 0;
      const status = formatGrnStatusLabel(line.grn_status || order.grn_status);
      return `${itemNo}. ${name} | Ordered: ${ordered} | Received: ${received} | ${status}`;
    })
    .join("\n");
}

export function buildGrnExportRows(
  orders: ScmVendorPo[],
  vendors: Record<string, { label: string }>,
): GrnExportRow[] {
  const rows: GrnExportRow[] = [];
  let serial = 0;

  for (const order of orders) {
    serial += 1;
    const vendor = vendors[order.vendor_id]?.label || order.vendor_id;
    const poNumber = order.company_po_number?.trim() || order.document_number;
    const poDate = formatDate(order.document_date);
    const grnStatus = formatGrnStatusLabel(order.grn_status);
    const grnNumber = resolveGrnNumber(order);
    const grnDate = formatDate(order.receipt_saved_at || order.document_date);

    rows.push({
      "S.No": serial,
      "Company PO Number": poNumber,
      "PO Date": poDate,
      Vendor: vendor,
      "GRN Status": grnStatus,
      "GRN Number": grnNumber,
      "GRN Date": grnDate,
      Items: formatItemsCell(order),
    });
  }

  return rows;
}

export async function exportGrnsXlsx(filename: string, rows: GrnExportRow[]) {
  const data = rows.length
    ? rows
    : [Object.fromEntries(HEADERS.map((h) => [h, ""])) as GrnExportRow];

  await downloadXlsx(filename, [{ name: "GRNs", rows: data }]);
}
