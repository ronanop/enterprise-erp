import type { ScmStockAvailability } from "@/services/procurement-service";

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

export function ovfStockSourceKey(ovfId: string): string {
  return `ovf-stock:${ovfId}`;
}

export function ovfStockChallanHref(ovfId: string): string {
  const params = new URLSearchParams({
    source: "ovf_stock",
    ovfId,
    kind: "delivery_challan",
    returnTo: "/procurement/delivery-challan",
  });
  return `/procurement/delivery-challan/new?${params.toString()}`;
}

export function ovfFromStockHref(ovfId: string): string {
  return `/procurement/scm/ovf/${ovfId}/from-stock`;
}

export function ovfCreatePoRemainderHref(ovfId: string): string {
  return `/procurement/scm/ovf/${ovfId}/po?from=stock-remainder`;
}
