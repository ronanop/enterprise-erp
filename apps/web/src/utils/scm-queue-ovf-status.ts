import type { ScmQueueItem } from "@/services/procurement-service";

export type ScmOvfQueueStatus = "open" | "close" | "hold" | "draft";

function pendingIdSet(value: unknown): ReadonlySet<string> | null {
  if (value && typeof value === "object" && typeof (value as { has?: unknown }).has === "function") {
    return value as ReadonlySet<string>;
  }
  return null;
}

/**
 * OVF status for SCM queue (matches scm-queue-page).
 * A PO sent for admin approval closes the OVF even while the PO is still draft.
 */
export function deriveScmOvfQueueStatus(
  row: ScmQueueItem,
  pendingOrderIds?: ReadonlySet<string>,
): ScmOvfQueueStatus {
  const status = (row.purchase_order_status || "").toLowerCase();
  const pending = pendingIdSet(pendingOrderIds);
  if (
    row.purchase_order_id &&
    pending?.has(row.purchase_order_id) &&
    status === "draft"
  ) {
    return "close";
  }
  if (status === "draft" && row.purchase_order_id && !row.can_create_po) {
    return "draft";
  }
  if (row.scm_on_hold || status === "hold" || status === "cancelled") return "hold";
  if (row.stock_fulfillment_status === "complete" && !row.can_create_po) return "close";
  if (!row.purchase_order_id || row.can_create_po) return "open";
  if (status === "submitted" || status === "") return "open";
  return "close";
}

export function isScmOpenOvfRow(
  row: ScmQueueItem,
  pendingOrderIds?: ReadonlySet<string>,
): boolean {
  const s = deriveScmOvfQueueStatus(row, pendingOrderIds);
  return s === "open" || s === "draft";
}

export function isScmHoldOvfRow(row: ScmQueueItem): boolean {
  return deriveScmOvfQueueStatus(row) === "hold";
}
