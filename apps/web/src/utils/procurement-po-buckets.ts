import type { ProcOrder } from "@/services/procurement-service";

export type PoOverviewBucket = "draft" | "open" | "partial" | "close";

export type PoBucketCounts = Record<PoOverviewBucket, number>;

export function deriveGrnStatus(order: ProcOrder): "pending" | "partial" | "closed" {
  const lines = order.lines || [];
  if (lines.length === 0) return "pending";
  const badges = new Set<"pending" | "partial" | "delivered">();
  for (const ln of lines) {
    const qty = Number(ln.quantity) || 0;
    const recv = Number(ln.quantity_received) || 0;
    const lineStatus = (ln.status || "").toLowerCase();
    if (lineStatus === "received" || lineStatus === "closed" || (qty > 0 && recv >= qty)) {
      badges.add("delivered");
    } else if (recv > 0) {
      badges.add("partial");
    } else {
      badges.add("pending");
    }
  }
  if (badges.size === 1 && badges.has("delivered")) return "closed";
  if (badges.has("partial") || badges.has("delivered")) return "partial";
  return "pending";
}

export function poOverviewBucketForOrder(
  order: ProcOrder,
  grnStatus?: "pending" | "partial" | "closed",
): PoOverviewBucket | null {
  const status = (order.status || "").toLowerCase();
  if (status === "cancelled") return null;
  if (status === "draft") return "draft";
  const grn = grnStatus ?? deriveGrnStatus(order);
  if (grn === "closed") return "close";
  if (grn === "partial") return "partial";
  return "open";
}

export function emptyPoBucketCounts(): PoBucketCounts {
  return { draft: 0, open: 0, partial: 0, close: 0 };
}

export function countPoBuckets(orders: ProcOrder[]): PoBucketCounts {
  const counts = emptyPoBucketCounts();
  for (const order of orders) {
    const grn = deriveGrnStatus(order);
    const bucket = poOverviewBucketForOrder(order, grn);
    if (bucket) counts[bucket] += 1;
  }
  return counts;
}

export function filterOrdersByPoBucket(
  orders: Array<ProcOrder & { grn_status?: string }>,
  bucket: PoOverviewBucket,
): Array<ProcOrder & { grn_status?: string }> {
  return orders.filter((row) => {
    const grn = (row.grn_status as "pending" | "partial" | "closed") ?? deriveGrnStatus(row);
    return poOverviewBucketForOrder(row, grn) === bucket;
  });
}

export function parsePoOverviewBucket(value: string | null): PoOverviewBucket {
  if (value === "draft" || value === "open" || value === "partial" || value === "close") {
    return value;
  }
  return "open";
}

export const PO_OVERVIEW_BUCKET_LABELS: Record<PoOverviewBucket, string> = {
  draft: "Draft PO",
  open: "Open PO",
  partial: "Partial PO",
  close: "Close PO",
};
