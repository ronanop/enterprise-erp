import type { ScmQueueItem } from "@/services/procurement-service";

export type ScmOvfQueueStatus = "open" | "close" | "hold" | "draft";

/**
 * OVF status for SCM queue (matches scm-queue-page).
 */
export function deriveScmOvfQueueStatus(row: ScmQueueItem): ScmOvfQueueStatus {
  const status = (row.purchase_order_status || "").toLowerCase();
  if (status === "draft" && row.purchase_order_id && !row.can_create_po) {
    return "draft";
  }
  if (row.scm_on_hold || status === "hold" || status === "cancelled") return "hold";
  if (!row.purchase_order_id || row.can_create_po) return "open";
  if (status === "submitted" || status === "") return "open";
  return "close";
}

export function isScmOpenOvfRow(row: ScmQueueItem): boolean {
  const s = deriveScmOvfQueueStatus(row);
  return s === "open" || s === "draft";
}

export function isScmHoldOvfRow(row: ScmQueueItem): boolean {
  return deriveScmOvfQueueStatus(row) === "hold";
}
