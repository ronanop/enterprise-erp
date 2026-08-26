import type {
  ScmOvfPreview,
  ScmOvfStockAllocation,
  ScmStockAvailability,
  ScmVendorLine,
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

/** Matches CRM/API `_is_in_stock_distributor` — inventory path, not a vendor PO. */
export function isInStockDistributor(value: string | null | undefined): boolean {
  const key = (value || "").trim().toLowerCase().replace(/\s+/g, " ");
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
