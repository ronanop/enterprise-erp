import type {
  ProcurementInventoryRow,
  ScmVendorPo,
} from "@/services/procurement-service";
import { formatGrnStatusBadgeLabel } from "@/utils/grn-status-display";
import { countGrnDocumentsForPo } from "@/utils/procurement-pipeline-metrics";
import { isGrnNonBilledStockRow, nonBilledStockQuantity } from "@/utils/procurement-inventory-report";

export type PoGrnBillingRow = {
  orderId: string;
  companyPo: string;
  vendor: string;
  poStatus: string;
  grnStatus: string;
  grnStatusKey: string;
  grnDocuments: number;
  /** All GRN document numbers for this PO (oldest → newest). */
  grnNumbers: string[];
  qtyOrdered: number;
  qtyReceived: number;
  qtyBilled: number;
  qtyUnbilled: number;
  receiptPct: number;
  billedPct: number;
};

function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function formatPoStatus(status: string): string {
  const value = (status || "").trim().toLowerCase();
  if (!value) return "—";
  if (value === "partially_received") return "Partially received";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseGrnSequenceFromNumber(grnNumber: string | null | undefined): number {
  const value = (grnNumber || "").trim();
  if (!value) return 0;
  const tail = value.split("/").pop() || "";
  const n = Number.parseInt(tail, 10);
  return Number.isFinite(n) ? n : 0;
}

function poBase(po: ScmVendorPo): string {
  return (po.company_po_number || po.document_number || "PO").trim();
}

/**
 * Every GRN number tied to this PO:
 * - sequences 1..grn_sequence (PO/CDT/007/001, /002, …)
 * - plus any distinct GRN numbers from inventory stock rows
 */
export function listGrnNumbersForPo(
  po: ScmVendorPo,
  inventory: ProcurementInventoryRow[] = [],
): string[] {
  const base = poBase(po);
  const current = (po.current_grn_number || "").trim();
  const seqCount = Math.max(
    countGrnDocumentsForPo(po),
    parseGrnSequenceFromNumber(current),
  );

  const bySeq = new Map<number, string>();
  for (let s = 1; s <= seqCount; s++) {
    bySeq.set(s, `${base}/${String(s).padStart(3, "0")}`);
  }
  if (current) {
    const curSeq = parseGrnSequenceFromNumber(current);
    if (curSeq > 0) bySeq.set(curSeq, current);
    else if (seqCount <= 1) bySeq.set(1, current);
  }

  for (const row of inventory) {
    if (row.order_id !== po.id) continue;
    const grn = (row.grn_number || "").trim();
    if (!grn || grn === "Imported") continue;
    const seq = parseGrnSequenceFromNumber(grn);
    if (seq > 0) bySeq.set(seq, grn);
  }

  if (bySeq.size === 0) return [];
  return [...bySeq.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, number]) => number);
}

export function buildPoGrnBillingRows(
  vendorPos: ScmVendorPo[],
  inventory: ProcurementInventoryRow[],
  vendors: Record<string, { label: string }>,
): PoGrnBillingRow[] {
  const unbilledByOrder = new Map<string, number>();
  for (const row of inventory.filter(isGrnNonBilledStockRow)) {
    const orderId = row.order_id?.trim();
    if (!orderId) continue;
    unbilledByOrder.set(
      orderId,
      (unbilledByOrder.get(orderId) ?? 0) + nonBilledStockQuantity(row),
    );
  }

  const rows: PoGrnBillingRow[] = [];
  for (const po of vendorPos) {
    const status = (po.status || "").toLowerCase();
    if (status === "draft" || status === "submitted" || status === "cancelled") continue;

    let qtyOrdered = 0;
    let qtyReceived = 0;
    let lastBillingQty = 0;
    for (const ln of po.lines || []) {
      qtyOrdered += Math.max(0, Number(ln.quantity) || 0);
      qtyReceived += Math.max(0, Number(ln.quantity_received) || 0);
      lastBillingQty += Math.max(0, Number(ln.last_receipt_billing_quantity) || 0);
    }

    const qtyUnbilled = Math.max(0, unbilledByOrder.get(po.id) ?? 0);
    const qtyBilled =
      qtyUnbilled > 0 || unbilledByOrder.has(po.id)
        ? Math.max(0, qtyReceived - qtyUnbilled)
        : lastBillingQty > 0
          ? Math.min(qtyReceived, lastBillingQty)
          : qtyReceived > 0
            ? qtyReceived
            : 0;

    const receiptPct =
      qtyOrdered > 0 ? Math.min(100, Math.round((qtyReceived / qtyOrdered) * 1000) / 10) : 0;
    const billedPct =
      qtyReceived > 0 ? Math.min(100, Math.round((qtyBilled / qtyReceived) * 1000) / 10) : 0;

    const grnNumbers = listGrnNumbersForPo(po, inventory);
    const grnDocuments = Math.max(countGrnDocumentsForPo(po), grnNumbers.length);

    rows.push({
      orderId: po.id,
      companyPo: (po.company_po_number || po.document_number || "—").trim(),
      vendor: vendors[po.vendor_id]?.label || po.vendor_id,
      poStatus: formatPoStatus(po.status),
      grnStatus: formatGrnStatusBadgeLabel(po.grn_status) || "—",
      grnStatusKey: (po.grn_status || "pending").toLowerCase(),
      grnDocuments,
      grnNumbers,
      qtyOrdered: roundQty(qtyOrdered),
      qtyReceived: roundQty(qtyReceived),
      qtyBilled: roundQty(qtyBilled),
      qtyUnbilled: roundQty(Math.max(0, qtyReceived - qtyBilled)),
      receiptPct,
      billedPct,
    });
  }

  return rows.sort((a, b) => a.companyPo.localeCompare(b.companyPo, undefined, { numeric: true }));
}

export function poGrnBillingExportRows(rows: PoGrnBillingRow[]): Record<string, string | number>[] {
  return rows.map((row, index) => ({
    "#": index + 1,
    "Company PO": row.companyPo,
    Vendor: row.vendor,
    "PO status": row.poStatus,
    "GRN status": row.grnStatus,
    "GRN documents": row.grnDocuments,
    "GRN numbers": row.grnNumbers.join(", "),
    Ordered: row.qtyOrdered,
    Received: row.qtyReceived,
    Billed: row.qtyBilled,
    Unbilled: row.qtyUnbilled,
    "Received %": row.receiptPct,
    "Billed % of received": row.billedPct,
  }));
}
