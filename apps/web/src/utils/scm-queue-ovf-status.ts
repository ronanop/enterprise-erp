import type { ScmLinkedPurchaseOrder, ScmPoGroup } from "@/services/procurement-service";

export type ScmOvfQueueStatus = "open" | "partial" | "close" | "hold" | "draft";

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
  po_groups?: ScmPoGroup[] | null;
  /** Non-stock vendor demand qty that needs Create PO coverage. */
  required_po_qty?: number | null;
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

function activeOrders(row: ScmOvfStatusSource): ScmLinkedPurchaseOrder[] {
  return linkedOrders(row).filter((order) => {
    const s = (order.status || "").toLowerCase();
    if (s === "cancelled") return false;
    // A vendor-rejected PO is stopped, so it no longer covers any item.
    return (order.fulfillment_stage || "").toLowerCase() !== "vendor_rejected";
  });
}

/**
 * Prefer quantity coverage when the API provides required/ordered qty.
 * Partial Create PO (e.g. 6 of 10) must stay Partial, not Close.
 */
function qtyCoverage(row: ScmOvfStatusSource): { covered: number; total: number } | null {
  const required = Number(row.required_po_qty);
  if (!Number.isFinite(required) || required < 0) return null;

  const orders = activeOrders(row);
  const hasQtySignal =
    orders.length === 0 || orders.some((order) => order.total_qty != null);
  if (!hasQtySignal) return null;

  const ordered = orders.reduce((sum, order) => {
    const qty = Number(order.total_qty);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);

  return {
    covered: Math.min(ordered, required),
    total: required,
  };
}

/**
 * Item lines that need Create PO vs lines already covered by a vendor PO.
 * Uses distributor po_groups (qty-aware when ordered/required are present).
 */
export function scmOvfPoItemCoverage(row: ScmOvfStatusSource): {
  covered: number;
  total: number;
} {
  const groups = row.po_groups;
  const hasGroupQty =
    Array.isArray(groups) &&
    groups.some((group) => Number.isFinite(Number(group.required_qty)) && Number(group.required_qty) > 0);

  // Per-distributor coverage first: an over-ordered distributor must not hide
  // another distributor's items that still need a PO.
  if (!hasGroupQty) {
    const fromQty = qtyCoverage(row);
    if (fromQty) return fromQty;
  }

  if (Array.isArray(groups) && groups.length > 0) {
    let covered = 0;
    let total = 0;
    for (const group of groups) {
      const requiredQty = Number(group.required_qty);
      const orderedQty = Number(group.ordered_qty);
      if (Number.isFinite(requiredQty) && requiredQty > 0) {
        total += requiredQty;
        covered += Math.min(
          Number.isFinite(orderedQty) ? orderedQty : group.has_po ? requiredQty : 0,
          requiredQty,
        );
        continue;
      }
      const lines = Math.max(1, Number(group.line_count) || 1);
      total += lines;
      if (group.has_po) covered += lines;
    }
    return { covered, total };
  }

  const orders = activeOrders(row);
  const open = openDistributorCount(row);
  if (orders.length === 0 && open === 0) {
    const linkedFallback =
      Boolean(row.company_po_number || row.purchase_order_id) &&
      (row.purchase_order_status || "").toLowerCase() !== "cancelled"
        ? 1
        : 0;
    return { covered: linkedFallback, total: linkedFallback };
  }
  const covered = orders.length;
  return { covered, total: covered + open };
}

/**
 * OVF status for SCM queue / dashboard.
 *
 * - Open    = no Create PO yet for any required item
 * - Partial = Create PO done for some (not all) required qty/items
 * - Close   = Create PO done for every required qty (or stock covers all demand)
 * - Hold    = SCM parked the OVF (or cancelled without a live PO)
 * - Draft   = reserved (mapped into Open KPIs)
 *
 * Important: do not use `can_create_po` alone - the API keeps it true while a draft
 * exists so the Create PO screen can reopen the draft for editing.
 */
export function deriveScmOvfQueueStatus(
  row: ScmOvfStatusSource,
  pendingOrderIds?: ReadonlySet<string>,
): ScmOvfQueueStatus {
  const status = (row.purchase_order_status || "").toLowerCase();
  if (row.scm_on_hold || status === "hold") return "hold";

  const orders = linkedOrders(row);
  const { covered, total } = scmOvfPoItemCoverage(row);
  const pending = pendingIdSet(pendingOrderIds);
  const orderIds = orders.map((order) => order.id).filter(Boolean);
  const allCoveredPending =
    total > 0 &&
    covered >= total &&
    orderIds.some((id) => pending?.has(id));

  // Fully covered demand from stock with nothing left to buy → Close.
  if (row.stock_fulfillment_status === "complete" && total === 0) {
    return "close";
  }

  if (total === 0) {
    if (status === "cancelled") return "hold";
    const active = orders.filter((order) => {
      const s = (order.status || "").toLowerCase();
      return s !== "cancelled";
    });
    if (active.length > 0 || allCoveredPending) return "close";
    return "open";
  }

  if (covered <= 0) {
    if (status === "cancelled" && orders.length === 0) return "hold";
    return "open";
  }

  if (covered + 1e-9 < total) return "partial";

  // A distributor group that still has no PO means items are left to create.
  if (openDistributorCount(row) > 0) return "partial";

  // All required qty/items have a PO (draft or issued), including finalize-pending.
  return "close";
}

export function isScmOpenOvfRow(
  row: ScmOvfStatusSource,
  pendingOrderIds?: ReadonlySet<string>,
): boolean {
  const s = deriveScmOvfQueueStatus(row, pendingOrderIds);
  return s === "open" || s === "draft" || s === "partial";
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
