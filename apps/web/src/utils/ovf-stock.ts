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
    if (!serial || serial === "—" || serial === "-") continue;
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
    const name = (line.distributor_name || "").trim() || "Vendor";
    const key = name.toLowerCase().replace(/\s+/g, " ");
    const existing = groups.get(key);
    if (existing) existing.lines.push(line);
    else groups.set(key, { distributorName: name, lines: [line] });
  }
  return [...groups.entries()].map(([key, value]) => ({ key, ...value }));
}

export function ovfCreatePoHref(ovfId: string, distributorName?: string | null): string {
  const params = new URLSearchParams();
  const name = (distributorName || "").trim();
  if (name) params.set("distributor", name);
  const qs = params.toString();
  return qs ? `/procurement/scm/ovf/${ovfId}/po?${qs}` : `/procurement/scm/ovf/${ovfId}/po`;
}

export function ovfCreatePoRemainderHref(ovfId: string, distributorName?: string | null): string {
  const base = ovfCreatePoHref(ovfId, distributorName);
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

export function takeOvfPoRemainderProducts(ovfId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PO_REMAINDER_PRODUCTS_KEY(ovfId));
    window.sessionStorage.removeItem(PO_REMAINDER_PRODUCTS_KEY(ovfId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const names = parsed.map((row) => String(row || "").trim()).filter(Boolean);
    return names.length > 0 ? names : null;
  } catch {
    return null;
  }
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
  if (options.remainderFromStock) {
    const limited = takeOvfPoRemainderProducts(options.ovfId);
    if (!limited || limited.length === 0) return all;
    const keys = new Set(limited.map((name) => ovfProductKey(name)));
    const matched = all.filter((ln) => keys.has(ovfProductKey(ln.product_name)));
    return matched.length > 0 ? matched : all;
  }
  return ovfPoSeedVendorLines(all, options.distributorParam);
}

/** Item description per product — same source as OVF VendorPurchaseTable (`ScmVendorLine.description`). */
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
  if (group?.has_po && group.purchase_order_id) {
    return {
      id: String(group.purchase_order_id),
      label: group.company_po_number || group.document_number || "PO",
      status: group.status,
    };
  }

  const needle = ovfDistributorKey(distributorName);
  const linked = preview.purchase_orders?.find((row) => {
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
    if (serial && serial !== "—" && serial !== "-" && !serials.includes(serial)) {
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
    if (serial && serial !== "—" && serial !== "-" && !serials.includes(serial)) {
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
  serial_number?: string | null;
  grn_number?: string | null;
  unit_cost?: number;
};

export function buildGrnPoInventoryShipLines(
  inventory: ProcurementInventoryRow[],
  linkedOrderIds: string[],
): OvfInventoryShipLine[] {
  const orders = new Set(linkedOrderIds.filter(Boolean));
  const lines: OvfInventoryShipLine[] = [];
  for (const row of inventory) {
    if (row.source !== "grn") continue;
    if (!row.order_id || !orders.has(row.order_id)) continue;
    const qty = Number(row.received_quantity) || 0;
    if (qty <= 0) continue;
    const product = (row.product_name || "").trim();
    if (!product) continue;
    const serial = (row.serial_number || "").trim();
    const grn = (row.grn_number || "").trim();
    const po = (row.company_po_number || "").trim();
    lines.push({
      id:
        row.stock_unit_id ||
        `${row.order_id}:${row.line_number}:${row.unit_index}:${product}`,
      source: "grn",
      product_name: product,
      max_qty: qty,
      detail:
        [
          grn ? `GRN ${grn}` : null,
          po ? `PO ${po}` : null,
          serial && serial !== "—" && serial !== "-"
            ? `Serial: ${serial}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || "In warehouse from PO GRN",
      order_id: row.order_id,
      stock_unit_id: row.stock_unit_id,
      serial_number: serial,
      grn_number: grn,
      unit_cost: Number(row.unit_cost) || 0,
    });
  }
  return lines.sort((a, b) => a.product_name.localeCompare(b.product_name));
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
        detail: serial && serial !== "—" && serial !== "-"
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

const OVF_INVENTORY_SHIP_SELECTION_KEY = (ovfId: string) =>
  `erp.scm.ovf-inventory-ship-selection:${ovfId}`;

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

/** Matches CRM/API `_is_in_stock_distributor` — inventory path, not a vendor PO. */
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
    if (!serial || serial === "—" || serial === "-") continue;
    if (!serials.includes(serial)) serials.push(serial);
  }
  return serials;
}
