import type { ProcurementRow, ScmVendorPo } from "@/services/procurement-service";
import { asNumber, asStatus } from "@/services/procurement-service";
import { listDeliveryChallans } from "@/utils/delivery-challan-storage";

export type ProcurementPipelineMetrics = {
  scm: number;
  orders: number;
  /** Actual GRN documents (batches). One PO can contribute many. */
  grns: number;
  /** POs that have at least one GRN / receipt. */
  posWithGrn: number;
  /** Issued POs with no receipt yet. */
  posAwaitingGrn: number;
  /** Issued POs partially received. */
  posPartial: number;
  /** Issued POs fully received. */
  posComplete: number;
  qtyOrdered: number;
  qtyReceived: number;
  /** 0–100 share of ordered qty received across issued POs. */
  receiptPct: number;
  /** Average GRN docs per PO that has receipts. */
  avgGrnsPerPo: number;
  "delivery-challan": number;
  "delivery-status": number;
};

function isIssuedPo(status: string): boolean {
  const value = status.toLowerCase();
  return value !== "draft" && value !== "submitted" && value !== "cancelled";
}

function lineQty(line: { quantity?: number; quantity_received?: number }) {
  return {
    ordered: Math.max(0, Number(line.quantity) || 0),
    received: Math.max(0, Number(line.quantity_received) || 0),
  };
}

/** Count GRN documents on a PO — prefers grn_sequence, falls back to 1 if any qty received. */
export function countGrnDocumentsForPo(po: {
  grn_sequence?: number | null;
  current_grn_number?: string | null;
  lines?: Array<{ quantity_received?: number }>;
}): number {
  const seq = Math.max(0, Math.floor(Number(po.grn_sequence) || 0));
  if (seq > 0) return seq;
  const hasReceived = (po.lines || []).some((ln) => Number(ln.quantity_received) > 0);
  if (hasReceived || (po.current_grn_number || "").trim()) return 1;
  return 0;
}

function derivePoReceiptBucket(
  po: ScmVendorPo | ProcurementRow,
): "awaiting" | "partial" | "complete" | null {
  const status = asStatus(po.status);
  if (!isIssuedPo(status)) return null;

  const lines = (Array.isArray(po.lines) ? po.lines : []) as Array<{
    quantity?: number;
    quantity_received?: number;
    status?: string;
  }>;

  const headerGrn = asStatus(po.grn_status);
  if (headerGrn === "closed" || headerGrn === "delivered") return "complete";
  if (headerGrn === "partial") return "partial";
  if (headerGrn === "pending") return "awaiting";

  if (lines.length === 0) return "awaiting";

  let anyReceived = false;
  let anyOpen = false;
  for (const ln of lines) {
    const { ordered, received } = lineQty(ln);
    const lineStatus = asStatus(ln.status);
    if (lineStatus === "received" || lineStatus === "closed" || (ordered > 0 && received >= ordered)) {
      anyReceived = true;
      continue;
    }
    if (received > 0) {
      anyReceived = true;
      anyOpen = true;
    } else {
      anyOpen = true;
    }
  }
  if (!anyReceived) return "awaiting";
  if (!anyOpen) return "complete";
  return "partial";
}

function asVendorPo(row: ProcurementRow | ScmVendorPo): ScmVendorPo {
  return row as ScmVendorPo;
}

export function buildProcurementPipelineMetrics(input: {
  scmQueueCount: number;
  vendorPos: Array<ProcurementRow | ScmVendorPo>;
}): ProcurementPipelineMetrics {
  const issued = input.vendorPos
    .map(asVendorPo)
    .filter((po) => isIssuedPo(String(po.status || "")));

  let grns = 0;
  let posWithGrn = 0;
  let posAwaitingGrn = 0;
  let posPartial = 0;
  let posComplete = 0;
  let qtyOrdered = 0;
  let qtyReceived = 0;

  for (const po of issued) {
    const docs = countGrnDocumentsForPo(po);
    grns += docs;
    if (docs > 0) posWithGrn += 1;

    const bucket = derivePoReceiptBucket(po);
    if (bucket === "awaiting") posAwaitingGrn += 1;
    else if (bucket === "partial") posPartial += 1;
    else if (bucket === "complete") posComplete += 1;

    for (const ln of po.lines || []) {
      const { ordered, received } = lineQty(ln);
      qtyOrdered += ordered;
      qtyReceived += Math.min(ordered || received, received);
    }
  }

  const receiptPct =
    qtyOrdered > 0 ? Math.min(100, Math.round((qtyReceived / qtyOrdered) * 1000) / 10) : 0;
  const avgGrnsPerPo =
    posWithGrn > 0 ? Math.round((grns / posWithGrn) * 10) / 10 : 0;

  let deliveryChallan = 0;
  try {
    deliveryChallan = listDeliveryChallans().length;
  } catch {
    deliveryChallan = 0;
  }

  return {
    scm: input.scmQueueCount,
    orders: issued.length,
    grns,
    posWithGrn,
    posAwaitingGrn,
    posPartial,
    posComplete,
    qtyOrdered,
    qtyReceived,
    receiptPct,
    avgGrnsPerPo,
    "delivery-challan": deliveryChallan,
    "delivery-status": 0,
  };
}

/** Stage counts only — for funnel bar widths. */
export function pipelineStageCountsFromMetrics(
  metrics: ProcurementPipelineMetrics,
): Record<string, number> {
  return {
    scm: metrics.scm,
    orders: metrics.orders,
    grns: metrics.grns,
    "delivery-challan": metrics["delivery-challan"],
    "delivery-status": metrics["delivery-status"],
  };
}

export function formatPipelineQty(value: number): string {
  return asNumber(value).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export type PoReceiptStatus = "awaiting" | "partial" | "complete";

export type PoReceiptBreakdownRow = {
  id: string;
  poNumber: string;
  status: PoReceiptStatus;
  grnCount: number;
  qtyOrdered: number;
  qtyReceived: number;
};

/** One row per vendor PO for the analytics GRN/receipt breakdown dialog. */
export function buildPoReceiptBreakdown(
  vendorPos: Array<ProcurementRow | ScmVendorPo>,
): PoReceiptBreakdownRow[] {
  const rows: PoReceiptBreakdownRow[] = [];

  for (const po of vendorPos.map(asVendorPo)) {
    const id = String(po.id || "").trim();
    if (!id) continue;

    let qtyOrdered = 0;
    let qtyReceived = 0;
    for (const ln of po.lines || []) {
      const { ordered, received } = lineQty(ln);
      qtyOrdered += ordered;
      qtyReceived += Math.min(ordered || received, received);
    }

    const bucket = derivePoReceiptBucket(po);
    const status: PoReceiptStatus =
      bucket ??
      (qtyReceived <= 0
        ? "awaiting"
        : qtyOrdered > 0 && qtyReceived + 1e-9 >= qtyOrdered
          ? "complete"
          : qtyReceived > 0
            ? "partial"
            : "awaiting");

    const poNumber =
      String(po.document_number || "").trim() ||
      String(po.company_po_number || "").trim() ||
      id;

    rows.push({
      id,
      poNumber,
      status,
      grnCount: countGrnDocumentsForPo(po),
      qtyOrdered,
      qtyReceived,
    });
  }

  return rows.sort((a, b) =>
    a.poNumber.localeCompare(b.poNumber, undefined, { numeric: true }),
  );
}
