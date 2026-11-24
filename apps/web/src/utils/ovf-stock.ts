import type {
  ScmOvfPreview,
  ScmOvfStockAllocation,
  ScmPoGroup,
  ScmStockAvailability,
  ScmVendorLine,
  ProcurementInventoryRow,
} from "@/services/procurement-service";

export function ovfProductKey(name: string | null | undefined): string {
  return (name || "").trim().toLowerCase();
}

export function findStockAvailability(
  rows: ScmStockAvailability[] | undefined,
  productName: string | null | undefined,
): ScmStockAvailability | undefined {
  const key = ovfProductKey(productName);
  if (!key) return undefined;
  return (rows || []).find((row) => ovfProductKey(row.product_name) === key);
}

export function ovfDemandLines(preview: Pick<ScmOvfPreview, "customer_lines" | "vendor_lines">): ScmVendorLine[] {
  return (preview.customer_lines?.length ? preview.customer_lines : preview.vendor_lines) || [];
}

export type OvfFulfillmentStatus = "inventory" | "remaining" | "split";

export type OvfFulfillmentRow = {
  product_name: string;
  required_qty: number;
  allocated_qty: number;
  remaining_qty: number;
  serials: string[];
  status: OvfFulfillmentStatus;
};

export function buildOvfFulfillmentRows(preview: ScmOvfPreview): OvfFulfillmentRow[] {
  const lines = ovfDemandLines(preview);
  const availability = preview.stock_availability || [];
  const allocations = preview.stock_allocations || [];
  const serialsByProduct = new Map<string, string[]>();
  for (const row of allocations) {
    const key = ovfProductKey(row.product_name);
    if (!key) continue;
    const serial = (row.serial_number || "").trim();
    if (!serial || serial === "-" || serial === "-") continue;
    const list = serialsByProduct.get(key) ?? [];
    if (!list.includes(serial)) list.push(serial);
    serialsByProduct.set(key, list);
  }

  const seen = new Set<string>();
  const rows: OvfFulfillmentRow[] = [];
  for (const line of lines) {
    const key = ovfProductKey(line.product_name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const stock = findStockAvailability(availability, line.product_name);
    const required = Number(stock?.required_qty ?? line.qty) || 0;
    const allocated = Number(stock?.allocated_qty) || 0;
    const remaining =
      Number(stock?.remaining_qty ?? Math.max(0, required - allocated)) || 0;
    const status: OvfFulfillmentStatus =
      allocated > 0 && remaining > 1e-6
        ? "split"
        : allocated > 0
          ? "inventory"
          : "remaining";
    rows.push({
      product_name: line.product_name,
      required_qty: required,
      allocated_qty: allocated,
      remaining_qty: remaining,
      serials: serialsByProduct.get(key) ?? [],
      status,
    });
  }
  return rows;
}

export function ovfStockSourceKey(ovfId: string): string {
  return `ovf-stock:${ovfId}`;
}

export function ovfGrnStockSourceKey(ovfId: string, recordId?: string): string {
  const base = `ovf-grn-stock:${ovfId}`;
  return recordId ? `${base}:${recordId}` : base;
}

export type OvfChallanShipSource = "inventory" | "po" | "combined";

export type OvfShipDocumentKind = "billing" | "delivery_challan";

export function ovfChallanHref(
  ovfId: string,
  source: OvfChallanShipSource,
  orderId?: string | null,
  kind: OvfShipDocumentKind = "delivery_challan",
): string {
  const params = new URLSearchParams({
    ovfId,
    kind,
    returnTo: `/procurement/scm/ovf/${ovfId}`,
  });
  if (source === "inventory") {
    params.set("source", "ovf_stock");
  } else if (source === "po") {
    params.set("source", "ovf_po");
    if (orderId) params.set("orderId", orderId);
  } else {
    params.set("source", "ovf_combined");
    if (orderId) params.set("orderId", orderId);
  }
  return `/procurement/delivery-challan/new?${params.toString()}`;
}

/** Ship warehouse stock received on a PO GRN (not OVF book-from-stock allocations). */
export function ovfGrnStockChallanHref(
  ovfId: string,
  orderId: string,
  kind: OvfShipDocumentKind = "delivery_challan",
): string {
  const params = new URLSearchParams({
    ovfId,
    orderId,
    source: "ovf_grn_stock",
    kind,
    returnTo: `/procurement/scm/ovf/${ovfId}`,
  });
  return `/procurement/delivery-challan/new?${params.toString()}`;
}

/** Billing / DC from PO GRN warehouse stock (fulfillment panel — no OVF required). */
export function poGrnStockSourceKey(orderId: string, recordId?: string): string {
  const base = `po-grn-stock:${orderId}`;
  return recordId ? `${base}:${recordId}` : base;
}

export function poGrnStockChallanHref(
  orderId: string,
  kind: OvfShipDocumentKind = "delivery_challan",
  returnTo?: string | null,
  ovfId?: string | null,
  batchKey?: string | null,
): string {
  const params = new URLSearchParams({
    orderId,
    source: "po_grn_stock",
    kind,
  });
  if (returnTo?.trim()) params.set("returnTo", returnTo.trim());
  if (ovfId?.trim()) params.set("ovfId", ovfId.trim());
  if (batchKey?.trim()) params.set("batchKey", batchKey.trim());
  return `/procurement/delivery-challan/new?${params.toString()}`;
}

export function ovfStockChallanHref(ovfId: string): string {
  return ovfChallanHref(ovfId, "inventory");
}

export function ovfFromStockHref(ovfId: string, fromItemPlan = false): string {
  const base = `/procurement/scm/ovf/${ovfId}/from-stock`;
  return fromItemPlan ? `${base}?from=item-plan` : base;
}

export function ovfItemPlanHref(ovfId: string): string {
  return `/procurement/scm/ovf/${ovfId}/item-plan`;
}

export function ovfVendorPoGroups(
  lines: ScmVendorLine[],
): Array<{ key: string; distributorName: string; lines: ScmVendorLine[] }> {
  const groups = new Map<string, { distributorName: string; lines: ScmVendorLine[] }>();
  for (const line of lines) {
    if (ovfLineIsInventoryFulfillment(line)) continue;
    const raw = (line.distributor_name || "").trim();
    const name = raw && raw.toLowerCase() !== "vendor" ? raw : "";
    const key = (name || "__unassigned__").toLowerCase().replace(/\s+/g, " ");
    const existing = groups.get(key);
    if (existing) existing.lines.push(line);
    else groups.set(key, { distributorName: name, lines: [line] });
  }
  return [...groups.entries()].map(([key, value]) => ({ key, ...value }));
}

export function ovfCreatePoHref(
  ovfId: string,
  distributorName?: string | null,
  distributorState?: string | null,
): string {
  const params = new URLSearchParams();
  const name = (distributorName || "").trim();
  if (name) params.set("distributor", name);
  const state = (distributorState || "").trim();
  if (state) params.set("state", state);
  const qs = params.toString();
  return qs ? `/procurement/scm/ovf/${ovfId}/po?${qs}` : `/procurement/scm/ovf/${ovfId}/po`;
}

export function ovfCreatePoRemainderHref(
  ovfId: string,
  distributorName?: string | null,
  distributorState?: string | null,
): string {
  const base = ovfCreatePoHref(ovfId, distributorName, distributorState);
  return `${base}${base.includes("?") ? "&" : "?"}from=stock-remainder`;
}

const PO_REMAINDER_PRODUCTS_KEY = (ovfId: string) =>
  `erp.scm.ovf-po-remainder-products:${ovfId}`;

/** Limit stock-remainder Create PO to these inventory shortfall products (combined PO). */
export function setOvfPoRemainderProducts(ovfId: string, productNames: string[]): void {
  if (typeof window === "undefined") return;
  const names = productNames.map((name) => name.trim()).filter(Boolean);
  try {
    if (names.length === 0) {
      window.sessionStorage.removeItem(PO_REMAINDER_PRODUCTS_KEY(ovfId));
      return;
    }
    window.sessionStorage.setItem(PO_REMAINDER_PRODUCTS_KEY(ovfId), JSON.stringify(names));
  } catch {
    /* ignore quota */
  }
}

function readOvfPoRemainderProducts(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const names = parsed.map((row) => String(row || "").trim()).filter(Boolean);
    return names.length > 0 ? names : null;
  } catch {
    return null;
  }
}

export function peekOvfPoRemainderProducts(ovfId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    return readOvfPoRemainderProducts(
      window.sessionStorage.getItem(PO_REMAINDER_PRODUCTS_KEY(ovfId)),
    );
  } catch {
    return null;
  }
}

export function takeOvfPoRemainderProducts(ovfId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const key = PO_REMAINDER_PRODUCTS_KEY(ovfId);
    const names = readOvfPoRemainderProducts(window.sessionStorage.getItem(key));
    window.sessionStorage.removeItem(key);
    return names;
  } catch {
    return null;
  }
}

export function clearOvfPoRemainderProducts(ovfId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PO_REMAINDER_PRODUCTS_KEY(ovfId));
  } catch {
    /* ignore */
  }
}

const PO_LINE_QTY_OVERRIDES_KEY = (ovfId: string) =>
  `erp.scm.ovf-po-line-qtys:${ovfId}`;

/** Per-product qty for the next Create PO (from item-plan qty selection). */
export function setOvfPoLineQtyOverrides(
  ovfId: string,
  qtys: Record<string, number>,
): void {
  if (typeof window === "undefined") return;
  try {
    const cleaned: Record<string, number> = {};
    for (const [key, value] of Object.entries(qtys)) {
      const productKey = ovfProductKey(key) || key.trim().toLowerCase();
      const qty = Number(value);
      if (!productKey || !Number.isFinite(qty) || qty <= 0) continue;
      cleaned[productKey] = qty;
    }
    if (Object.keys(cleaned).length === 0) {
      window.sessionStorage.removeItem(PO_LINE_QTY_OVERRIDES_KEY(ovfId));
      return;
    }
    window.sessionStorage.setItem(PO_LINE_QTY_OVERRIDES_KEY(ovfId), JSON.stringify(cleaned));
  } catch {
    /* ignore quota */
  }
}

function readOvfPoLineQtyOverrides(raw: string | null): Record<string, number> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const qty = Number(value);
      if (!key || !Number.isFinite(qty) || qty <= 0) continue;
      out[key] = qty;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function peekOvfPoLineQtyOverrides(ovfId: string): Record<string, number> | null {
  if (typeof window === "undefined") return null;
  try {
    return readOvfPoLineQtyOverrides(window.sessionStorage.getItem(PO_LINE_QTY_OVERRIDES_KEY(ovfId)));
  } catch {
    return null;
  }
}

export function takeOvfPoLineQtyOverrides(ovfId: string): Record<string, number> | null {
  if (typeof window === "undefined") return null;
  try {
    const key = PO_LINE_QTY_OVERRIDES_KEY(ovfId);
    const overrides = readOvfPoLineQtyOverrides(window.sessionStorage.getItem(key));
    window.sessionStorage.removeItem(key);
    return overrides;
  } catch {
    return null;
  }
}

export function clearOvfPoLineQtyOverrides(ovfId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PO_LINE_QTY_OVERRIDES_KEY(ovfId));
  } catch {
    /* ignore */
  }
}

export type OvfItemPlanSplitRow = {
  id: string;
  product_name: string;
  distributor_name: string;
  /** Vendor supply state used to pick the matching address entry. */
  distributor_state?: string | null;
  source: string;
  action: string;
  /** Index in API item_plan.lines (for vendor PATCH). Copied onto remainder rows. */
  api_line_index: number;
  /** Qty still available on this row for Create PO / booking. */
  qty: number;
  /** Qty selected for the next Create PO (1..qty). */
  create_qty: number;
  po_qty: number;
  book_qty: number;
  on_hand_qty: number;
  allocated_qty: number;
  in_stock: boolean;
  /** True after Create PO was opened for this row's create_qty. */
  po_started: boolean;
  /** PO created specifically for this split row (unique even when distributor matches). */
  linked_po_id?: string | null;
  linked_po_label?: string | null;
};

const ITEM_PLAN_SPLITS_KEY = (ovfId: string) => `erp.scm.ovf-item-plan-splits:${ovfId}`;

export function saveOvfItemPlanSplits(ovfId: string, rows: OvfItemPlanSplitRow[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ITEM_PLAN_SPLITS_KEY(ovfId), JSON.stringify(rows));
  } catch {
    /* ignore quota */
  }
}

export function loadOvfItemPlanSplits(ovfId: string): OvfItemPlanSplitRow[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ITEM_PLAN_SPLITS_KEY(ovfId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as OvfItemPlanSplitRow[];
  } catch {
    return null;
  }
}

export function clearOvfItemPlanSplits(ovfId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ITEM_PLAN_SPLITS_KEY(ovfId));
  } catch {
    /* ignore */
  }
}

const PENDING_ITEM_PLAN_PO_ROW_KEY = (ovfId: string) =>
  `erp.scm.ovf-pending-item-plan-po-row:${ovfId}`;

function readPendingItemPlanPoRowIds(raw: string | null): string[] {
  const text = (raw || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((id) => String(id || "").trim()).filter(Boolean);
    }
  } catch {
    /* legacy single-id string */
  }
  return [text];
}

/** Remember which item-plan split row(s) the next Create PO belongs to. */
export function setOvfPendingItemPlanPoRows(ovfId: string, rowIds: string[]): void {
  if (typeof window === "undefined") return;
  const ids = [...new Set(rowIds.map((id) => (id || "").trim()).filter(Boolean))];
  try {
    if (ids.length === 0) {
      window.sessionStorage.removeItem(PENDING_ITEM_PLAN_PO_ROW_KEY(ovfId));
      return;
    }
    window.sessionStorage.setItem(PENDING_ITEM_PLAN_PO_ROW_KEY(ovfId), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/** @deprecated Prefer setOvfPendingItemPlanPoRows */
export function setOvfPendingItemPlanPoRow(ovfId: string, rowId: string): void {
  setOvfPendingItemPlanPoRows(ovfId, [rowId]);
}

export function peekOvfPendingItemPlanPoRows(ovfId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return readPendingItemPlanPoRowIds(
      window.sessionStorage.getItem(PENDING_ITEM_PLAN_PO_ROW_KEY(ovfId)),
    );
  } catch {
    return [];
  }
}

export function peekOvfPendingItemPlanPoRow(ovfId: string): string | null {
  return peekOvfPendingItemPlanPoRows(ovfId)[0] || null;
}

export function takeOvfPendingItemPlanPoRows(ovfId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const key = PENDING_ITEM_PLAN_PO_ROW_KEY(ovfId);
    const ids = readPendingItemPlanPoRowIds(window.sessionStorage.getItem(key));
    window.sessionStorage.removeItem(key);
    return ids;
  } catch {
    return [];
  }
}

export function takeOvfPendingItemPlanPoRow(ovfId: string): string | null {
  return takeOvfPendingItemPlanPoRows(ovfId)[0] || null;
}

/** Persist the created PO onto one or more pending item-plan split rows. */
export function bindOvfItemPlanRowsToPo(
  ovfId: string,
  rowIds: string[] | string | null | undefined,
  po: { id: string; label: string },
): void {
  const targets = new Set(
    (Array.isArray(rowIds) ? rowIds : rowIds ? [rowIds] : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );
  const poId = String(po.id || "").trim();
  const label = (po.label || "").trim();
  if (targets.size === 0 || !poId) return;
  const rows = loadOvfItemPlanSplits(ovfId);
  if (!rows) return;
  const next = rows.map((row) =>
    targets.has(row.id)
      ? {
        ...row,
        po_started: true,
        linked_po_id: poId,
        linked_po_label: label || poId,
      }
      : row,
  );
  saveOvfItemPlanSplits(ovfId, next);
}

/** @deprecated Prefer bindOvfItemPlanRowsToPo */
export function bindOvfItemPlanRowToPo(
  ovfId: string,
  rowId: string | null | undefined,
  po: { id: string; label: string },
): void {
  bindOvfItemPlanRowsToPo(ovfId, rowId, po);
}

type OvfPoLinkCandidate = {
  id: string;
  vendor_name?: string | null;
  company_po_number?: string | null;
  document_number?: string | null;
  status?: string | null;
  fulfillment_stage?: string | null;
  total_qty?: number | null;
};

function isCancelledPoStatus(status?: string | null): boolean {
  const value = (status || "").trim().toLowerCase();
  return value === "cancelled" || value === "canceled";
}

function isRejectedVendorPo(row: OvfPoLinkCandidate | null | undefined): boolean {
  return (row?.fulfillment_stage || "").trim().toLowerCase() === "vendor_rejected";
}

function newItemPlanRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Attach PO refs to item-plan rows from server purchase orders / po_groups.
 * Does not require local `po_started` — after a PO is saved (and approved),
 * Create PO is replaced by a clickable PO number. Partial cover splits a
 * remainder row that still offers Create PO.
 */
/** True when the item-plan Action column would still show Create PO for this row. */
export function itemPlanRowOffersCreatePo(
  row: OvfItemPlanSplitRow,
  onHold: boolean,
): boolean {
  const vendorName = (row.distributor_name || "").trim();
  const poEligible =
    row.qty > 0 &&
    !onHold &&
    (row.source === "purchase_order" ||
      (row.source === "inventory" &&
        (row.action === "stock_short" || (Number(row.po_qty) || 0) > 0)));
  const needsPo = poEligible && !isInStockDistributor(vendorName) && Boolean(vendorName);
  const hasCreatedPo = Boolean((row.linked_po_id || "").trim());
  return needsPo && !hasCreatedPo && (Number(row.create_qty) || 0) > 0;
}

export function assignUniquePosToItemPlanRows(
  rows: OvfItemPlanSplitRow[],
  purchaseOrders: OvfPoLinkCandidate[] | null | undefined,
  poGroups?: ScmPoGroup[] | null,
): OvfItemPlanSplitRow[] {
  const rejectedIds = new Set(
    (purchaseOrders || [])
      .filter((row) => isRejectedVendorPo(row) || isCancelledPoStatus(row.status))
      .map((row) => String(row.id)),
  );
  const unused = [...(purchaseOrders || [])].filter(
    (row) => Boolean(row?.id) && !rejectedIds.has(String(row.id)),
  );
  const claimed = new Set<string>();
  const poByDistributor = new Map<string, { id: string; label: string }>();
  const coverLeft = new Map<string, number>();

  for (const group of poGroups || []) {
    const key = ovfDistributorKey(group.distributor_name);
    if (!key || isCancelledPoStatus(group.status)) continue;
    const ordered = Number(group.ordered_qty);
    if (Number.isFinite(ordered) && ordered > 0) {
      coverLeft.set(key, (coverLeft.get(key) || 0) + ordered);
    }
  }
  for (const po of unused) {
    const key = ovfDistributorKey(po.vendor_name || "");
    if (!key || coverLeft.has(key)) continue;
    const qty = Number(po.total_qty);
    if (Number.isFinite(qty) && qty > 0) coverLeft.set(key, qty);
  }

  for (const row of rows) {
    if (!row.linked_po_id) continue;
    const id = String(row.linked_po_id);
    if (rejectedIds.has(id)) continue;
    claimed.add(id);
    const still = unused.findIndex((po) => String(po.id) === id);
    if (still >= 0) unused.splice(still, 1);
    const distKey = ovfDistributorKey(row.distributor_name);
    if (distKey && !poByDistributor.has(distKey)) {
      poByDistributor.set(distKey, {
        id,
        label: (row.linked_po_label || "").trim() || id,
      });
    }
    if (distKey && coverLeft.has(distKey)) {
      const left = Math.max(0, (coverLeft.get(distKey) || 0) - (Number(row.qty) || 0));
      coverLeft.set(distKey, Number(left.toFixed(4)));
    }
  }

  const takeMatch = (distributorName: string): { id: string; label: string } | null => {
    const needle = ovfDistributorKey(distributorName);
    if (needle && poByDistributor.has(needle)) {
      return poByDistributor.get(needle) || null;
    }
    const group = findPoGroupForDistributor(poGroups || undefined, distributorName);
    if (group?.purchase_order_id && !isCancelledPoStatus(group.status)) {
      const linked = {
        id: String(group.purchase_order_id),
        label:
          (group.company_po_number || group.document_number || "").trim() ||
          String(group.purchase_order_id),
      };
      claimed.add(linked.id);
      const still = unused.findIndex((po) => String(po.id) === linked.id);
      if (still >= 0) unused.splice(still, 1);
      if (needle) poByDistributor.set(needle, linked);
      return linked;
    }
    const matchIdx = unused.findIndex((po) => {
      const id = String(po.id);
      if (claimed.has(id)) return false;
      if (!needle) return true;
      const vendorName = ovfDistributorKey(po.vendor_name || "");
      return (
        Boolean(vendorName) &&
        (vendorName === needle || vendorName.includes(needle) || needle.includes(vendorName))
      );
    });
    if (matchIdx < 0) return null;
    const [po] = unused.splice(matchIdx, 1);
    const linked = {
      id: String(po.id),
      label:
        (po.company_po_number || po.document_number || "").trim() || String(po.id),
    };
    claimed.add(linked.id);
    if (needle) poByDistributor.set(needle, linked);
    return linked;
  };

  const out: OvfItemPlanSplitRow[] = [];
  for (const row of rows) {
    if (row.linked_po_id && rejectedIds.has(String(row.linked_po_id))) {
      out.push({
        ...row,
        po_started: false,
        linked_po_id: null,
        linked_po_label: null,
      });
      continue;
    }
    if (row.linked_po_id) {
      out.push({ ...row, po_started: true });
      continue;
    }
    if (isInStockDistributor(row.distributor_name)) {
      out.push(row);
      continue;
    }
    const matched = takeMatch(row.distributor_name);
    if (!matched) {
      out.push(row);
      continue;
    }
    const distKey = ovfDistributorKey(row.distributor_name);
    const rowQty = Math.max(0, Number(row.qty) || 0);
    const available =
      distKey && coverLeft.has(distKey)
        ? Math.max(0, coverLeft.get(distKey) || 0)
        : rowQty;
    if (available <= 1e-9) {
      out.push(row);
      continue;
    }
    const coveredQty = Math.min(rowQty, available);
    const remainderQty = Math.max(0, Number((rowQty - coveredQty).toFixed(4)));
    if (distKey) {
      coverLeft.set(distKey, Number(Math.max(0, available - coveredQty).toFixed(4)));
    }
    out.push({
      ...row,
      qty: coveredQty,
      create_qty: coveredQty,
      po_started: true,
      linked_po_id: matched.id,
      linked_po_label: matched.label,
    });
    if (remainderQty > 1e-9) {
      out.push({
        ...row,
        id: newItemPlanRowId(),
        qty: remainderQty,
        create_qty: remainderQty,
        po_started: false,
        linked_po_id: null,
        linked_po_label: null,
      });
    }
  }
  return out;
}

export function ovfPoSeedVendorLines(
  lines: ScmVendorLine[],
  distributorName?: string | null,
): ScmVendorLine[] {
  const groups = ovfVendorPoGroups(lines);
  if (groups.length === 0) return [];
  const needle = (distributorName || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (needle) {
    const match = groups.find((group) => group.key === needle);
    if (match) return match.lines;
  }
  return groups[0].lines;
}

/** Vendor lines used to seed Create PO (distributor filter or remainder-from-stock). */
export function ovfCreatePoSeedVendorLines(
  preview: Pick<ScmOvfPreview, "vendor_lines">,
  options: {
    ovfId: string;
    distributorParam?: string | null;
    remainderFromStock?: boolean;
  },
): ScmVendorLine[] {
  const all = preview.vendor_lines || [];
  let seed: ScmVendorLine[];
  if (options.remainderFromStock) {
    // Peek (not take) so React remounts / dual seed calls still see the same selection.
    const limited = peekOvfPoRemainderProducts(options.ovfId);
    if (!limited || limited.length === 0) {
      seed = all;
    } else {
      const keys = new Set(limited.map((name) => ovfProductKey(name)));
      const matched = all.filter((ln) => keys.has(ovfProductKey(ln.product_name)));
      seed = matched.length > 0 ? matched : all;
    }
  } else {
    seed = ovfPoSeedVendorLines(all, options.distributorParam);
  }

  const qtyOverrides = peekOvfPoLineQtyOverrides(options.ovfId);
  if (!qtyOverrides) return seed;

  const filtered = seed
    .map((ln) => {
      const key = ovfProductKey(ln.product_name);
      if (!key || !(key in qtyOverrides)) return null;
      const qty = qtyOverrides[key];
      return { ...ln, qty };
    })
    .filter((ln): ln is ScmVendorLine => ln != null);
  return filtered.length > 0 ? filtered : seed;
}

/** Item description per product - same source as OVF VendorPurchaseTable (`ScmVendorLine.description`). */
export function ovfVendorDescriptionByProduct(
  lines: ScmVendorLine[],
  fallbackLines?: ScmVendorLine[],
): Map<string, string> {
  const map = new Map<string, string>();
  const ingest = (rows: ScmVendorLine[]) => {
    for (const ln of rows) {
      const key = ovfProductKey(ln.product_name);
      if (!key || map.has(key)) continue;
      const desc = (ln.description || "").trim();
      if (desc) map.set(key, desc);
    }
  };
  ingest(lines);
  if (fallbackLines?.length) ingest(fallbackLines);
  return map;
}

export function ovfDistributorKey(name: string | null | undefined): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function findPoGroupForDistributor(
  poGroups: ScmPoGroup[] | undefined,
  distributorName: string,
): ScmPoGroup | undefined {
  const needle = ovfDistributorKey(distributorName);
  if (!needle) return undefined;
  return poGroups?.find((group) => ovfDistributorKey(group.distributor_name) === needle);
}

export type OvfLinkedPoRef = {
  id: string;
  label: string;
  status?: string | null;
};

export function resolvePoForDistributor(
  preview: Pick<ScmOvfPreview, "po_groups" | "purchase_orders">,
  distributorName: string,
): OvfLinkedPoRef | null {
  const group = findPoGroupForDistributor(preview.po_groups, distributorName);
  // Return the PO even when ordered qty is only partial (has_po=false).
  if (group?.purchase_order_id && !isCancelledPoStatus(group.status)) {
    return {
      id: String(group.purchase_order_id),
      label: group.company_po_number || group.document_number || "PO",
      status: group.status,
    };
  }

  const needle = ovfDistributorKey(distributorName);
  const linked = preview.purchase_orders?.find((row) => {
    if (isCancelledPoStatus(row.status)) return false;
    const vendorName = ovfDistributorKey(row.vendor_name);
    return vendorName && (vendorName === needle || vendorName.includes(needle) || needle.includes(vendorName));
  });
  if (linked?.id) {
    return {
      id: String(linked.id),
      label: linked.company_po_number || linked.document_number || "PO",
      status: linked.status,
    };
  }
  return null;
}

/** GRN receipt is allowed after admin issues the PO (not while draft/submitted). */
export function poAllowsGrnRecording(status?: string | null): boolean {
  const value = (status || "").trim().toLowerCase();
  return Boolean(value) && !["draft", "submitted", "cancelled", "canceled"].includes(value);
}

export type OvfShipItemPreview = {
  product_name: string;
  qty: number;
  detail?: string | null;
};

/** Products booked from GRN stock onto this OVF (matches delivery challan inventory lines). */
export function ovfInventoryShipItemPreviews(
  preview: Pick<ScmOvfPreview, "stock_allocations" | "stock_availability">,
): OvfShipItemPreview[] {
  const byProduct = new Map<string, OvfShipItemPreview & { serials: string[] }>();
  for (const row of preview.stock_allocations || []) {
    const product = (row.product_name || "").trim();
    if (!product) continue;
    const qty = Number(row.quantity) || 0;
    if (qty <= 0) continue;
    const key = ovfProductKey(product);
    const serial = (row.serial_number || "").trim();
    const prev = byProduct.get(key);
    const serials = prev ? [...prev.serials] : [];
    if (serial && serial !== "-" && serial !== "-" && !serials.includes(serial)) {
      serials.push(serial);
    }
    byProduct.set(key, {
      product_name: product,
      qty: (prev?.qty || 0) + qty,
      detail: null,
      serials,
    });
  }
  if (byProduct.size > 0) {
    return [...byProduct.values()].map(({ product_name, qty, serials }) => ({
      product_name,
      qty,
      detail:
        serials.length > 0
          ? `Serials: ${serials.join(", ")}`
          : "From GRN stock",
    }));
  }

  return (preview.stock_availability || [])
    .filter((row) => Number(row.allocated_qty) > 0)
    .map((row) => ({
      product_name: row.product_name,
      qty: Number(row.allocated_qty) || 0,
      detail: "Booked from inventory",
    }));
}

/** Vendor PO demand lines on this OVF (matches delivery challan PO lines). */
export function ovfPoShipItemPreviews(
  preview: Pick<ScmOvfPreview, "item_plan" | "po_groups" | "purchase_orders">,
): OvfShipItemPreview[] {
  return (preview.item_plan?.lines || [])
    .filter((line) => line.source === "purchase_order")
    .map((line) => {
      const vendor = (line.distributor_name || "").trim();
      const po = vendor ? resolvePoForDistributor(preview, vendor) : null;
      return {
        product_name: line.product_name,
        qty: Number(line.po_qty ?? line.qty) || 0,
        detail: [po?.label, vendor].filter(Boolean).join(" · ") || null,
      };
    })
    .filter((row) => row.qty > 0);
}

export function mergeOvfShipItemPreviews(
  ...lists: OvfShipItemPreview[][]
): OvfShipItemPreview[] {
  const byProduct = new Map<
    string,
    { product_name: string; qty: number; details: string[] }
  >();
  for (const list of lists) {
    for (const item of list) {
      const key = ovfProductKey(item.product_name);
      if (!key) continue;
      const prev = byProduct.get(key);
      const detail = (item.detail || "").trim();
      if (prev) {
        prev.qty += item.qty;
        if (detail && !prev.details.includes(detail)) prev.details.push(detail);
      } else {
        byProduct.set(key, {
          product_name: item.product_name,
          qty: item.qty,
          details: detail ? [detail] : [],
        });
      }
    }
  }
  return [...byProduct.values()].map(({ product_name, qty, details }) => ({
    product_name,
    qty,
    detail: details.join(" · ") || null,
  }));
}

/** Warehouse stock from PO GRN(s) linked to this OVF. */
export function grnPoInventoryShipItemPreviews(
  inventory: ProcurementInventoryRow[],
  linkedOrderIds: string[],
): OvfShipItemPreview[] {
  const orders = new Set(linkedOrderIds.filter(Boolean));
  if (orders.size === 0) return [];
  const byProduct = new Map<
    string,
    OvfShipItemPreview & { serials: string[]; grns: Set<string> }
  >();
  for (const row of inventory) {
    if (row.source !== "grn") continue;
    if (!row.order_id || !orders.has(row.order_id)) continue;
    const qty = Number(row.received_quantity) || 0;
    if (qty <= 0) continue;
    const product = (row.product_name || "").trim();
    if (!product) continue;
    const key = ovfProductKey(product);
    const serial = (row.serial_number || "").trim();
    const prev = byProduct.get(key);
    const serials = prev ? [...prev.serials] : [];
    if (serial && serial !== "-" && serial !== "-" && !serials.includes(serial)) {
      serials.push(serial);
    }
    const grns = prev ? new Set(prev.grns) : new Set<string>();
    const grn = (row.grn_number || "").trim();
    if (grn) grns.add(grn);
    byProduct.set(key, {
      product_name: product,
      qty: (prev?.qty || 0) + qty,
      detail: null,
      serials,
      grns,
    });
  }
  return [...byProduct.values()].map(({ product_name, qty, serials, grns }) => ({
    product_name,
    qty,
    detail:
      [
        grns.size > 0 ? `GRN ${[...grns].join(", ")}` : null,
        serials.length > 0 ? `Serials: ${serials.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "In warehouse from PO GRN",
  }));
}

export type OvfInventoryShipLineSource = "grn" | "ovf_booking";

/** One selectable warehouse / booked row for OVF inventory ship dialog. */
export type OvfInventoryShipLine = {
  id: string;
  source: OvfInventoryShipLineSource;
  product_name: string;
  max_qty: number;
  detail: string | null;
  order_id?: string | null;
  stock_unit_id?: string | null;
  /** All unit ids behind an aggregated product row (GRN stock). */
  stock_unit_ids?: string[];
  serial_number?: string | null;
  grn_number?: string | null;
  unit_cost?: number;
};

/**
 * GRN warehouse stock for linked PO(s), aggregated by product name so the
 * picker shows one row + qty box (not one row per serial unit).
 */
export function buildGrnPoInventoryShipLines(
  inventory: ProcurementInventoryRow[],
  linkedOrderIds: string[],
): OvfInventoryShipLine[] {
  const orders = new Set(linkedOrderIds.filter(Boolean));
  type Agg = {
    product_name: string;
    order_id: string;
    max_qty: number;
    stock_unit_ids: string[];
    serials: string[];
    grns: string[];
    po: string;
    unit_cost: number;
  };
  const byKey = new Map<string, Agg>();

  for (const row of inventory) {
    if (row.source !== "grn") continue;
    if (!row.order_id || !orders.has(row.order_id)) continue;
    const qty = Number(row.received_quantity) || 0;
    if (qty <= 0) continue;
    const product = (row.product_name || "").trim();
    if (!product) continue;
    const productKey = product.toLowerCase().replace(/\s+/g, " ");
    const key = `${row.order_id}:${productKey}`;
    const serial = (row.serial_number || "").trim();
    const grn = (row.grn_number || "").trim();
    const po = (row.company_po_number || "").trim();
    const unitId = (row.stock_unit_id || "").trim();
    const existing = byKey.get(key);
    if (existing) {
      existing.max_qty += qty;
      if (unitId && !existing.stock_unit_ids.includes(unitId)) {
        existing.stock_unit_ids.push(unitId);
      }
      if (serial && serial !== "-" && !existing.serials.includes(serial)) {
        existing.serials.push(serial);
      }
      if (grn && !existing.grns.includes(grn)) existing.grns.push(grn);
      if (!existing.po && po) existing.po = po;
      if (!existing.unit_cost && Number(row.unit_cost) > 0) {
        existing.unit_cost = Number(row.unit_cost) || 0;
      }
    } else {
      byKey.set(key, {
        product_name: product,
        order_id: row.order_id,
        max_qty: qty,
        stock_unit_ids: unitId ? [unitId] : [],
        serials: serial && serial !== "-" ? [serial] : [],
        grns: grn ? [grn] : [],
        po,
        unit_cost: Number(row.unit_cost) || 0,
      });
    }
  }

  return Array.from(byKey.values())
    .map((agg) => {
      const grnLabel =
        agg.grns.length === 0
          ? null
          : agg.grns.length === 1
            ? `GRN ${agg.grns[0]}`
            : `GRN ${agg.grns.join(", ")}`;
      const qtyLabel = `${agg.max_qty} available`;
      return {
        id: `grn-agg:${agg.order_id}:${agg.product_name.toLowerCase().replace(/\s+/g, " ")}`,
        source: "grn" as const,
        product_name: agg.product_name,
        max_qty: agg.max_qty,
        detail:
          [grnLabel, agg.po ? `PO ${agg.po}` : null, qtyLabel]
            .filter(Boolean)
            .join(" · ") || "In warehouse from PO GRN",
        order_id: agg.order_id,
        stock_unit_id: agg.stock_unit_ids[0] || null,
        stock_unit_ids: agg.stock_unit_ids,
        serial_number: null,
        grn_number: agg.grns.join(", ") || null,
        unit_cost: agg.unit_cost,
      };
    })
    .sort((a, b) => a.product_name.localeCompare(b.product_name));
}

export function buildOvfBookedInventoryShipLines(
  preview: Pick<ScmOvfPreview, "stock_allocations">,
): OvfInventoryShipLine[] {
  return (preview.stock_allocations || [])
    .filter((row) => Number(row.quantity) > 0)
    .map((row) => {
      const serial = (row.serial_number || "").trim();
      return {
        id: row.id || row.stock_unit_id,
        source: "ovf_booking" as const,
        product_name: (row.product_name || "").trim(),
        max_qty: Number(row.quantity) || 0,
        detail: serial && serial !== "-" && serial !== "-"
          ? `Serial: ${serial} · Booked on OVF`
          : "Booked from inventory on OVF",
        stock_unit_id: row.stock_unit_id,
        serial_number: serial,
      };
    })
    .filter((row) => row.product_name && row.max_qty > 0);
}

export type OvfInventoryShipSelectionLine = {
  id: string;
  source: OvfInventoryShipLineSource;
  product_name: string;
  qty: number;
  stock_unit_id?: string | null;
  serial_number?: string | null;
  grn_number?: string | null;
  unit_cost?: number;
};

export type OvfInventoryShipSelection = {
  ovf_id: string;
  order_id: string;
  lines: OvfInventoryShipSelectionLine[];
};

export type PoGrnStockShipSelection = {
  order_id: string;
  lines: OvfInventoryShipSelectionLine[];
};

const OVF_INVENTORY_SHIP_SELECTION_KEY = (ovfId: string) =>
  `erp.scm.ovf-inventory-ship-selection:${ovfId}`;

const PO_GRN_STOCK_SHIP_SELECTION_KEY = (orderId: string) =>
  `erp.scm.po-grn-stock-ship-selection:${orderId}`;

export function setPoGrnStockShipSelection(payload: PoGrnStockShipSelection): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PO_GRN_STOCK_SHIP_SELECTION_KEY(payload.order_id),
      JSON.stringify(payload),
    );
  } catch {
    /* ignore quota */
  }
}

export function takePoGrnStockShipSelection(
  orderId: string,
): PoGrnStockShipSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PO_GRN_STOCK_SHIP_SELECTION_KEY(orderId));
    window.sessionStorage.removeItem(PO_GRN_STOCK_SHIP_SELECTION_KEY(orderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PoGrnStockShipSelection;
    if (!parsed?.lines?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

const PO_GRN_PENDING_SELECTION_KEY = (batchKey: string) =>
  `erp.scm.po-grn-pending-selection:${batchKey}`;

/** Persist selection with Billing/DC queue row so reopen from list keeps lines. */
export function setPoGrnPendingShipSelection(
  batchKey: string,
  payload: PoGrnStockShipSelection,
): void {
  if (typeof window === "undefined" || !batchKey.trim()) return;
  try {
    window.sessionStorage.setItem(
      PO_GRN_PENDING_SELECTION_KEY(batchKey.trim()),
      JSON.stringify(payload),
    );
  } catch {
    /* ignore quota */
  }
}

/** Peek only — keep until Billing/DC form is saved so list reopen still works. */
export function takePoGrnPendingShipSelection(
  batchKey: string,
): PoGrnStockShipSelection | null {
  if (typeof window === "undefined" || !batchKey.trim()) return null;
  try {
    const raw = window.sessionStorage.getItem(
      PO_GRN_PENDING_SELECTION_KEY(batchKey.trim()),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PoGrnStockShipSelection;
    if (!parsed?.lines?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPoGrnPendingShipSelection(batchKey: string): void {
  if (typeof window === "undefined" || !batchKey.trim()) return;
  try {
    window.sessionStorage.removeItem(PO_GRN_PENDING_SELECTION_KEY(batchKey.trim()));
  } catch {
    /* ignore */
  }
}

export function setOvfInventoryShipSelection(payload: OvfInventoryShipSelection): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      OVF_INVENTORY_SHIP_SELECTION_KEY(payload.ovf_id),
      JSON.stringify(payload),
    );
  } catch {
    /* ignore quota */
  }
}

export function takeOvfInventoryShipSelection(
  ovfId: string,
): OvfInventoryShipSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(OVF_INVENTORY_SHIP_SELECTION_KEY(ovfId));
    window.sessionStorage.removeItem(OVF_INVENTORY_SHIP_SELECTION_KEY(ovfId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OvfInventoryShipSelection;
    if (!parsed?.lines?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Matches CRM/API `_is_in_stock_distributor` - inventory path, not a vendor PO. */
export const IN_STOCK_DISTRIBUTOR_LABEL = "IN STOCK";

export function isInStockDistributor(value: string | null | undefined): boolean {
  const key = (value || "").trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
  return (
    key === "in stock" ||
    key === "instock" ||
    key === "inventory" ||
    key === "from inventory" ||
    key === "from stock"
  );
}

export function ovfLineIsInventoryFulfillment(
  line: Pick<ScmVendorLine, "fulfillment_source" | "distributor_name">,
): boolean {
  if (line.fulfillment_source === "inventory") return true;
  if (line.fulfillment_source === "purchase_order") return false;
  return isInStockDistributor(line.distributor_name);
}

/**
 * When every line is IN STOCK, Create PO needs admin approval
 * (stock short / used elsewhere, or user chooses PO instead of inventory).
 */
export function ovfRequiresInStockCreatePoApproval(
  preview: Pick<ScmOvfPreview, "vendor_lines" | "customer_lines" | "distributor_name">,
): boolean {
  const lines =
    (preview.vendor_lines?.length ? preview.vendor_lines : preview.customer_lines) || [];
  if (lines.length === 0) {
    return isInStockDistributor(preview.distributor_name);
  }
  return lines.every((line) => ovfLineIsInventoryFulfillment(line));
}

export function ovfHasInventoryShortfall(
  preview: Pick<ScmOvfPreview, "stock_availability">,
): boolean {
  return (preview.stock_availability || []).some(
    (row) => Number(row.remaining_qty) > 0 && Number(row.on_hand_qty) < Number(row.remaining_qty),
  );
}

export function allocationSerialsForProduct(
  allocations: ScmOvfStockAllocation[] | undefined,
  productName: string,
): string[] {
  const key = ovfProductKey(productName);
  const serials: string[] = [];
  for (const row of allocations || []) {
    if (ovfProductKey(row.product_name) !== key) continue;
    const serial = (row.serial_number || "").trim();
    if (!serial || serial === "-" || serial === "-") continue;
    if (!serials.includes(serial)) serials.push(serial);
  }
  return serials;
}
