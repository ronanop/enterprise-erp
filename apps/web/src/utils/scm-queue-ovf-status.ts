import type { ScmLinkedPurchaseOrder } from "@/services/procurement-service";

export type ScmOvfQueueStatus = "open" | "close" | "hold" | "draft";

/** Minimal fields shared by SCM queue rows and OVF preview. */
export type ScmOvfStatusSource = {
  purchase_order_id?: string | null;
  purchase_order_number?: string | null;
  purchase_order_status?: string | null;
  company_po_number?: string | null;
  can_create_po?: boolean;
  scm_on_hold?: boolean;
  stock_fulfillment_status?: string | null;
  open_distributor_names?: string[] | null;
  purchase_orders?: ScmLinkedPurchaseOrder[] | null;
};

function pendingIdSet(value: unknown): ReadonlySet<string> | null {
  if (value && typeof value === "object" && typeof (value as { has?: unknown }).has === "function") {
    return value as ReadonlySet<string>;
  }
  return null;
}

function linkedOrders(row: ScmOvfStatusSource): ScmLinkedPurchaseOrder[] {
  if (Array.isArray(row.purchase_orders) && row.purchase_orders.length > 0) {
    return row.purchase_orders;
  }
  if (row.purchase_order_id) {
    return [
      {
        id: row.purchase_order_id,
        status: row.purchase_order_status,
        document_number: row.purchase_order_number,
        company_po_number: row.company_po_number,
      },
    ];
  }
  return [];
}

function openDistributorCount(row: ScmOvfStatusSource): number {
  return (row.open_distributor_names || [])
    .map((name) => String(name || "").trim())
    .filter(Boolean).length;
}

/**
 * OVF status for SCM queue / dashboard.
 *
 * - Open  = no vendor PO yet, or at least one distributor still needs a PO
 * - Close = every required vendor PO exists (draft or issued), or sent for admin
 *           approval, or demand is fully covered from stock
 * - Hold  = SCM parked the OVF (or cancelled without a live PO)
 * - Draft = reserved (mapped into Open KPIs); not used when PO creation closes the OVF
 *
 * Important: do not use `can_create_po` alone — the API keeps it true while a draft
 * exists so the Create PO screen can reopen the draft for editing.
 */
export function deriveScmOvfQueueStatus(
  row: ScmOvfStatusSource,
  pendingOrderIds?: ReadonlySet<string>,
): ScmOvfQueueStatus {
  const status = (row.purchase_order_status || "").toLowerCase();
  if (row.scm_on_hold || status === "hold") return "hold";

  const orders = linkedOrders(row);
  const orderIds = orders.map((order) => order.id).filter(Boolean);
  const pending = pendingIdSet(pendingOrderIds);

  // Forwarded for admin finalize approval → Close even while draft.
  if (orderIds.some((id) => pending?.has(id))) return "close";

  const stillNeedsVendorPo = openDistributorCount(row) > 0;
  if (row.stock_fulfillment_status === "complete" && !stillNeedsVendorPo) {
    return "close";
  }

  if (orders.length === 0) {
    if (status === "cancelled") return "hold";
    return "open";
  }

  // Multi-distributor: stay Open until every vendor group has a PO.
  if (stillNeedsVendorPo) return "open";

  // All required vendor POs exist (including drafts) → Close.
  const active = orders.filter((order) => {
    const s = (order.status || "").toLowerCase();
    return s !== "cancelled";
  });
  if (active.length === 0) return "hold";
  return "close";
}

export function isScmOpenOvfRow(
  row: ScmOvfStatusSource,
  pendingOrderIds?: ReadonlySet<string>,
): boolean {
  const s = deriveScmOvfQueueStatus(row, pendingOrderIds);
  return s === "open" || s === "draft";
}

export function isScmHoldOvfRow(row: ScmOvfStatusSource): boolean {
  return deriveScmOvfQueueStatus(row) === "hold";
}

/** Pending finalize approval order ids (for queue Close). */
export function pendingFinalizeOrderIds(
  approvalsByOrder: Map<string, { status?: string }>,
): Set<string> {
  const out = new Set<string>();
  for (const [orderId, approval] of approvalsByOrder.entries()) {
    if (approval?.status === "pending") out.add(orderId);
  }
  return out;
}
