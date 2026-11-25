import { resolvePoLifecycleStatus } from "@/utils/procurement-po-lifecycle-status";

export const ORDER_EXPORT_HEADERS = [
  "PO number",
  "Company entity name",
  "OVF number",
  "Customer PO number",
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
  18,
  20,
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

/** Fulfillment chain before GRN is complete → Excel "Pending". */
const PRE_GRN_FULFILLMENT_STAGES = new Set([
  "awaiting_vendor_send",
  "awaiting_vendor_response",
  "vendor_accepted",
  "customer_notified",
  "vendor_dispatch_recorded",
]);

/** PO status labels for Excel (lifecycle vocabulary; pre-GRN chain → Pending). */
export function formatPoStatusForExport(
  status: string,
  extras?: {
    scm_approval_stage?: string | null;
    fulfillment_stage?: string | null;
    vendor_response_status?: string | null;
    po_sent_to_vendor_at?: string | null;
  },
): string {
  if (!(status || "").trim() && !extras) return "";
  const statusKey = (status || "").trim().toLowerCase();
  if (
    statusKey !== "cancelled" &&
    statusKey !== "canceled" &&
    statusKey !== "closed" &&
    statusKey !== "received" &&
    statusKey !== "partially_received" &&
    statusKey !== "draft" &&
    statusKey !== "submitted"
  ) {
    const fulfillment = (extras?.fulfillment_stage || "").trim().toLowerCase();
    if (PRE_GRN_FULFILLMENT_STAGES.has(fulfillment)) {
      return "Pending";
    }
  }
  return resolvePoLifecycleStatus({
    status,
    scm_approval_stage: extras?.scm_approval_stage,
    fulfillment_stage: extras?.fulfillment_stage,
    vendor_response_status: extras?.vendor_response_status,
    po_sent_to_vendor_at: extras?.po_sent_to_vendor_at,
  });
}

export function normalizeOrderExportRow(row: OrderExportRow): OrderExportRow {
  const out = { ...row };
  const raw = out[PO_STATUS_HEADER];
  out[PO_STATUS_HEADER] = formatPoStatusForExport(String(raw ?? ""));
  return out;
}
