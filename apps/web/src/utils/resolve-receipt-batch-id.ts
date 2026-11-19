import type { ProcOrder } from "@/services/procurement-service";

/** Receipt batch id for the latest GRN / vendor-invoice upload on this PO. */
export function resolveReceiptBatchId(order: ProcOrder | null | undefined): string | null {
  if (!order) return null;
  const headerId = order.current_receipt_batch_id?.trim();
  if (headerId) return headerId;
  const lineIds = (order.lines || [])
    .map((ln) => ln.last_receipt_batch_id?.trim())
    .filter((id): id is string => Boolean(id));
  if (lineIds.length === 0) return null;
  return lineIds[lineIds.length - 1] ?? null;
}
