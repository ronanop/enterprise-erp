export const ORDER_EXPORT_HEADERS = [
  "PO number",
  "Company entity name",
  "Customer name",
  "Customer pay terms",
  "Vendor name",
  "Vendor payment terms",
  "Customer amt",
  "Vendor amt",
  "Margin",
  "Margin perc",
  "Status",
] as const;

export type OrderExportRow = Record<(typeof ORDER_EXPORT_HEADERS)[number], string | number>;

export const ORDER_EXPORT_COLUMN_WIDTHS = [
  20,
  28,
  26,
  18,
  26,
  20,
  16,
  16,
  14,
  14,
  18,
];

const PO_STATUS_HEADER = "Status";

/** PO status labels for Excel (maps sent → Open). */
export function formatPoStatusForExport(status: string): string {
  const value = (status || "").trim().toLowerCase();
  if (!value) return "";
  switch (value) {
    case "sent":
    case "approved":
      return "Open";
    case "draft":
      return "Draft";
    case "partially_received":
      return "Partially Received";
    case "received":
      return "Received";
    case "closed":
      return "Closed";
    case "cancelled":
      return "Cancelled";
    case "submitted":
      return "Submitted";
    default:
      return value
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
  }
}

export function normalizeOrderExportRow(row: OrderExportRow): OrderExportRow {
  const out = { ...row };
  const raw = out[PO_STATUS_HEADER];
  out[PO_STATUS_HEADER] = formatPoStatusForExport(String(raw ?? ""));
  return out;
}
