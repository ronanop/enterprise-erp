/** Canonical PO lifecycle labels for list / detail / Excel. */

export type PoLifecycleStatus =
  | "Draft"
  | "Admin Approval"
  | "Management Approval"
  | "Approved"
  | "Sent to Vendor"
  | "Vendor Confirmed"
  | "Partially Received"
  | "Fully Received"
  | "Closed"
  | "Cancelled";

export type PoLifecycleInput = {
  status?: string | null;
  scm_approval_stage?: string | null;
  fulfillment_stage?: string | null;
  vendor_response_status?: string | null;
  po_sent_to_vendor_at?: string | null;
};

const VENDOR_CONFIRMED_STAGES = new Set([
  "vendor_accepted",
  "customer_notified",
  "vendor_dispatch_recorded",
  "grn_in_stock",
  "customer_delivery_ready",
  "customer_dispatched",
  "delivered",
]);

export function resolvePoLifecycleStatus(order: PoLifecycleInput): PoLifecycleStatus {
  const status = (order.status || "").trim().toLowerCase();
  const stage = (order.scm_approval_stage || "").trim().toLowerCase();
  const fulfillment = (order.fulfillment_stage || "").trim().toLowerCase();
  const vendorResponse = (order.vendor_response_status || "").trim().toLowerCase();

  if (!status) return "Draft";
  if (status === "cancelled" || status === "canceled") return "Cancelled";
  if (status === "closed") return "Closed";
  if (status === "received") return "Fully Received";
  if (status === "partially_received") return "Partially Received";

  if (status === "draft") return "Draft";

  if (status === "submitted") {
    if (stage === "management") return "Management Approval";
    return "Admin Approval";
  }

  // Issued / sent / approved — refine with fulfillment.
  if (
    fulfillment === "delivered" ||
    (status === "sent" && fulfillment === "delivered")
  ) {
    // Prefer receipt statuses above; keep Closed/Fully Received first.
  }

  if (
    VENDOR_CONFIRMED_STAGES.has(fulfillment) ||
    vendorResponse === "accepted" ||
    vendorResponse === "confirmed"
  ) {
    return "Vendor Confirmed";
  }

  if (
    status === "sent" ||
    Boolean(order.po_sent_to_vendor_at) ||
    fulfillment === "awaiting_vendor_send" ||
    fulfillment === "awaiting_vendor_response"
  ) {
    return "Sent to Vendor";
  }

  if (status === "approved" || status === "issued" || status === "ordered") {
    return "Approved";
  }

  return "Approved";
}

export function poLifecycleBadgeClass(label: PoLifecycleStatus): string {
  switch (label) {
    case "Draft":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "Admin Approval":
    case "Management Approval":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "Approved":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "Sent to Vendor":
      return "border-indigo-200 bg-indigo-50 text-indigo-900";
    case "Vendor Confirmed":
      return "border-violet-200 bg-violet-50 text-violet-900";
    case "Partially Received":
      return "border-orange-200 bg-orange-50 text-orange-900";
    case "Fully Received":
    case "Closed":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "Cancelled":
      return "border-red-200 bg-red-50 text-red-800";
    default:
      return "border-border bg-muted/40 text-foreground";
  }
}
