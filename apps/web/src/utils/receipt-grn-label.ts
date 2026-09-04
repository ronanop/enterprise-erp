import type { ProcOrder } from "@/services/procurement-service";

/** Align with API receipt batch window (~30 minutes). */
const RECEIPT_BATCH_WINDOW_MS = 30 * 60 * 1000;

/** GRN number for the receipt being saved (current batch or next sequence). */
export function receiptGrnLabelForOrder(order: ProcOrder): string {
  const poBase = order.company_po_number?.trim() || order.document_number || "PO";
  const current = order.current_grn_number?.trim();
  const at = order.current_receipt_batch_at;
  if (current && at) {
    const t = new Date(at).getTime();
    if (!Number.isNaN(t) && Date.now() - t <= RECEIPT_BATCH_WINDOW_MS) {
      return current;
    }
  }
  const nextSeq = (order.grn_sequence ?? 0) + 1;
  return `${poBase}/${String(nextSeq).padStart(3, "0")}`;
}
