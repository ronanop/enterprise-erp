export const ORDER_EXPORT_HEADERS = [
  "Customer name",
  "Customer PO",
  "Customer PO date",
  "Customer payment terms",
  "Customer PO amount",
  "Tax amount",
  "Total amount with tax",
  "Description",
  "Vendor name",
  "Payment term",
  "Cache PO",
  "Cache PO date",
  "Vendor amount",
  "Vendor tax",
  "Total with tax",
  "Margin",
  "Margin %",
  "PO status",
] as const;

export type OrderExportRow = Record<(typeof ORDER_EXPORT_HEADERS)[number], string | number>;

export const ORDER_EXPORT_COLUMN_WIDTHS = [
  26,
  20,
  20,
  24,
  22,
  16,
  26,
  44,
  26,
  20,
  20,
  20,
  20,
  18,
  18,
  20,
  14,
  18,
];

const PO_STATUS_HEADER = "PO status";

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
